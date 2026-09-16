/**
 * 이름 검색 회귀 — `node scripts/check-search.ts`
 *
 * ADR-052가 홈 검색을 걷어낸 이유가 **엉뚱한 결과**였다. 다시 붙이면서 그 증상과,
 * 고치는 과정에서 새로 만들 뻔한 증상을 함께 고정한다. 아래 단언은 전부 실측에서
 * 나왔다 — 지어낸 기대값이 하나도 없다.
 *
 * ⚠️ **이 스크립트는 순수 함수만 잰다. IME는 여기서 절대 안 잡힌다.**
 *    합성 이벤트로 만든 테스트는 조합 구간을 통과하지 못한다(→ ADR-053). 조합 중
 *    동작은 사람이 실제 한글 입력기로 쳐서 확인한다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { nameRank, normalizeQuery, rankedMatches } from '../app/utils/search.ts'

/**
 * 정류장 이름은 **실제 데이터에서** 만든다. 손으로 고른 몇 개로는 억제 버그가
 * 안 잡힌다 — `"병원"`이 8곳인 것을 알아야 1곳으로 주는 회귀를 볼 수 있다.
 */
const directions = JSON.parse(
  readFileSync(new URL('../server/data/station-directions.json', import.meta.url), 'utf8'),
).directions as Record<string, string>
const STOPS = [...new Set(Object.values(directions))]

/**
 * 관광지는 **이름을 고정한다.** 상류(TourAPI)에 달린 값을 회귀에 그대로 쓰면
 * 상류가 바뀌는 날 이 파일이 깨진다. 실측(2026-09-17)에서 뽑은 것들이다.
 */
const SPOTS = [
  '안동하회마을',
  '하회세계탈박물관',
  '도산서원',
  '경상북도산림과학박물관',
  '병산서원',
  '화천서원',
  '묵계서원',
  '안동문화예술의전당',
  '한국문화테마파크',
  '안동시립박물관',
  '안동소주전통음식박물관',
  '월영교',
]

const spotHits = (q: string) => rankedMatches(SPOTS, (s) => s, q, true)
const stopHits = (q: string) => rankedMatches(STOPS, (s) => s, q, false)

/** 홈이 하는 두 번째 폴백: 관광지가 한 곳이라도 걸리면 정류장은 평가하지 않는다. */
const search = (q: string) => {
  const spots = spotHits(q)
  return spots.length ? { kind: 'spot', list: spots } : { kind: 'stop', list: stopHits(q) }
}

// ── 조합 중인 낱자 ─────────────────────────────────────────────────────────
// IME는 음절이 끝나기 전 낱자를 그대로 넣는다. 떼지 않으면 결과가 0곳으로 깜빡인다.
assert.equal(normalizeQuery('하ㅎ'), '하')
assert.equal(normalizeQuery(' 하회 '), '하회')
// 초성 검색은 하지 않는다. 흉내 내면 "ㅎ"에 엉뚱한 곳이 쏟아진다. → ADR-052
assert.equal(normalizeQuery('ㅎ'), '')

// ── ADR-052가 지목한 증상 ─────────────────────────────────────────────────
// "도산"에 `경상북도산림과학박물관`이 딸려 나오던 것이 이 기능을 걷어낸 이유다.
assert.equal(nameRank('도산서원', '도산', true), 0)
assert.equal(nameRank('경상북도산림과학박물관', '도산', true), 1)
assert.deepEqual(spotHits('도산'), ['도산서원'])

// 같은 이름이 `"박물관"`에서는 **남아야 한다.** 여기선 우연이 아니라 정당한 매치다.
assert.ok(spotHits('박물관').includes('경상북도산림과학박물관'))
assert.equal(spotHits('박물관').length, 4)

// 시작 일치가 하나도 없으면 포함 일치로 내려간다. 넷 다 이름 중간에 걸린다.
assert.equal(spotHits('서원').length, 4)

// ── 시군 접두어 ───────────────────────────────────────────────────────────
// 사람은 "하회"라고 친다. LocgoHub가 앞에 붙인 `안동`은 데이터 아티팩트다.
assert.equal(nameRank('안동하회마을', '하회', true), 0)
//
// ⚠️ 접두어를 뗀 시작을 **한 단계 아래 티어로 내리면 안 된다.** 내리면
//    `하회세계탈박물관`(원본 시작)이 위 티어를 채워 `안동하회마을`이 통째로 숨는다.
//    안동에서 가장 많이 찾는 목적지다.
assert.equal(nameRank('하회세계탈박물관', '하회', true), 0)
assert.deepEqual(spotHits('하회').sort(), ['안동하회마을', '하회세계탈박물관'])

// 치르는 값. `안동문화예술의전당`이 티어를 채워 `한국문화테마파크`가 가려진다.
// 알고 받은 비용이다 — 위 `하회` 두 곳과 맞바꿨다. → ADR-054
assert.deepEqual(spotHits('문화'), ['안동문화예술의전당'])

// ── 정류장에는 접두어 규칙을 켜지 않는다 ───────────────────────────────────
// `안동`이 고유명사의 일부다. 켜면 시작 티어가 엉뚱하게 차서 나머지가 억제된다 —
// ADR-052의 `도산` 증상과 **똑같은 모양**이 방향만 반대로 나온다.
assert.equal(nameRank('안동병원', '병원', false), 1) // 0이면 회귀다
// 6곳·10곳은 이 코퍼스에서 그 낱말을 품은 이름 **전부**다. 하나라도 줄면 억제된 것이다.
assert.equal(stopHits('병원').length, 6)
assert.ok(stopHits('병원').some((n) => n.includes('성소병원')))
assert.equal(stopHits('초등학교').length, 10)
assert.ok(stopHits('초등학교').some((n) => n.includes('용상초등학교')))

// ── 괄호를 지우지 않는다 ──────────────────────────────────────────────────
// `안동역(안동터미널)`에서 괄호를 지우면 `안동역`이 되고, 시군 접두어까지 떼면
// `역`만 남는다. 그러면 **`터미널`이 영원히 안 걸린다** — 차 없이 여행하는 사람의
// 마지막 이동이 통째로 사라진다는 뜻이다. → ADR-050
assert.equal(nameRank('안동역(안동터미널)', '터미널', false), 1)
assert.deepEqual(stopHits('터미널'), ['안동역(안동터미널)'])
assert.deepEqual(stopHits('안동역'), ['안동역(안동터미널)'])

// ── 관광지가 걸리면 정류장은 보지 않는다 ───────────────────────────────────
// ADR-052의 "후보를 섞지 말 것". `"안동"`은 정류장 이름 48종에도 걸리지만,
// 관광지가 먼저 걸리므로 정류장 구간이 평가조차 되지 않는다.
assert.equal(search('하회').kind, 'spot')
assert.equal(search('안동').kind, 'spot')
// 관광 API에는 교통 거점이 한 곳도 없다. 그래서 이 둘은 정류장으로 내려간다.
assert.equal(search('안동역').kind, 'stop')
assert.equal(search('터미널').kind, 'stop')

// ── 빈 검색어 · 없는 이름 ─────────────────────────────────────────────────
assert.equal(nameRank('도산서원', '', true), -1)
assert.equal(spotHits('').length, 0)
assert.equal(search('zzz').list.length, 0)

console.log(`검색 회귀 통과 — 정류장 이름 ${STOPS.length}종 · 관광지 ${SPOTS.length}곳`)
