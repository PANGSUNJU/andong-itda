/**
 * 관광지 매칭 로직 회귀 검증 — `node scripts/check-spot-match.ts`
 *
 * 두 API에 공통 키가 없어 좌표+이름으로 같은 장소를 판정한다.
 * 잘못 붙으면 하회마을 카드에 탈박물관 사진이 걸린다. 그 회귀를 잡는다.
 */
import assert from 'node:assert/strict'

import {
  distanceMeters,
  keywordVariants,
  matchKorSpot,
  nameSimilarity,
  noiseReason,
  normalizeSpotName,
} from '../server/utils/tourApi.ts'

// LocgoHub는 시군명을 앞에 붙이고, KorService2는 괄호로 동명이소를 구분한다.
assert.equal(normalizeSpotName('안동하회마을'), '하회마을')
assert.equal(normalizeSpotName('개목사(안동)'), '개목사')
assert.equal(normalizeSpotName('하회 세계탈박물관'), '하회세계탈박물관')
// '안동'만으로 된 이름은 비워버리면 안 된다.
assert.equal(normalizeSpotName('안동'), '안동')
// KorService2가 붙이는 대괄호. 안 떼면 완전일치가 0.9로 떨어져 겸암정사에 진다.
assert.equal(normalizeSpotName('도산서원 [유네스코 세계유산]'), '도산서원')

assert.equal(nameSimilarity('안동하회마을', '하회마을'), 1) // 접두어를 떼면 완전일치
assert.equal(nameSimilarity('개목사(안동)', '개목사'), 1) // 괄호를 떼면 완전일치
assert.equal(nameSimilarity('월영교', '월영교및월영공원'), 0.9) // 포함관계
assert.ok(nameSimilarity('하회마을', '하회세계탈박물관') < 0.4) // 같은 좌표라도 다른 장소
assert.equal(nameSimilarity('', '월영교'), 0)

// 하회마을 좌표에서 자기 자신까지는 0m, 월영교까지는 20km가 넘는다.
assert.ok(distanceMeters(36.539062, 128.517994, 36.539062, 128.517994) < 1)
const hahoeToWolyeong = distanceMeters(36.539062, 128.517994, 36.576597, 128.760922)
assert.ok(hahoeToWolyeong > 20_000 && hahoeToWolyeong < 25_000, `${hahoeToWolyeong}m`)

const hub = {
  hubTatsCd: 'x'.repeat(32),
  hubTatsNm: '안동하회마을',
  hubCtgryLclsNm: '관광지',
  hubCtgryMclsNm: '역사관광',
  hubCtgrySclsNm: null,
  hubRank: '2',
  mapX: '128.517994889252000',
  mapY: '36.539062884929000',
  areaCd: '47',
  areaNm: '경상북도',
  signguCd: '47170',
  signguNm: '안동시',
  baseYm: '202606',
}

const kor = (title: string, mapx: string, mapy: string, contentid: string) =>
  ({ title, mapx, mapy, contentid }) as never

// 좌표가 1순위: 이름이 닮아도 200m를 넘으면 붙지 않는다.
assert.equal(matchKorSpot(hub, [kor('하회마을', '128.5300', '36.5450', '1')]), null)
// 200m 안이고 이름도 통과 → 매칭.
assert.equal(matchKorSpot(hub, [kor('하회마을', '128.518100', '36.539100', '2')])?.contentid, '2')
// 이름은 보조 게이트: 같은 좌표에 몰린 다른 장소는 걸러내고 진짜를 고른다.
assert.equal(
  matchKorSpot(hub, [
    kor('하회세계탈박물관', '128.517995', '36.539063', '3'), // 더 가깝지만 다른 장소
    kor('하회마을', '128.518200', '36.539200', '4'),
  ])?.contentid,
  '4',
)
// 통과하는 후보가 없으면 병합하지 않는다. LocgoHub 단독 표시가 정상 동작이다.
assert.equal(matchKorSpot(hub, [kor('하회세계탈박물관', '128.517995', '36.539063', '5')]), null)

/* 키워드 보충 — 지역 조회에 안 잡히는 항목을 이름으로 찾을 때 쓰는 검색어 */

// 그대로 검색하면 0건이다. '안동'을 뗀 변형이 있어야 하회마을이 잡힌다.
assert.deepEqual(keywordVariants('안동하회마을'), ['안동하회마을', '하회마을'])
// 상태·별칭은 슬래시 뒤에 붙는다. 그대로 검색어에 넣으면 아무것도 안 나온다.
assert.deepEqual(keywordVariants('낙강물길공원/공사중(2028년12월31일개장예정)'), ['낙강물길공원'])
// '안동'을 떼면 2글자만 남는 이름은 쪼개지 않는다. 너무 넓어진다.
assert.deepEqual(keywordVariants('안동역'), ['안동역'])
assert.deepEqual(keywordVariants('월영교'), ['월영교'])

/* 노이즈 필터 — ADR-022 */

// 걷어낼 것
assert.equal(noiseReason('남안동CC'), '골프장')
assert.equal(noiseReason('안동레이크GC'), '골프장')
assert.equal(noiseReason('CGV/안동'), '영화관')
assert.equal(noiseReason('롯데시네마/프리미엄안동'), '영화관')
assert.equal(noiseReason('안동역'), '교통시설')
assert.equal(noiseReason('옹천역/폐역'), '교통시설')
assert.equal(noiseReason('안동터미널'), '교통시설')
assert.equal(noiseReason('용상체육공원/야구장'), '체육시설')
assert.equal(noiseReason('안동드림베이스볼파크'), '체육시설')
assert.equal(noiseReason('안동수산물도매시장'), '도매시장')

// 남길 것 — 오탐이 나면 여행자가 갈 곳이 사라진다
assert.equal(noiseReason('안동하회마을'), null)
assert.equal(noiseReason('월영교'), null)
assert.equal(noiseReason('선성수상길'), null) // 레저스포츠지만 골프장이 아니다
assert.equal(noiseReason('유교랜드'), null)
assert.equal(noiseReason('중앙신시장'), null) // 전통시장은 남긴다
assert.equal(noiseReason('안동구시장'), null)
// 슬래시 뒤까지 보면 'KSI연수원'이 엉뚱한 패턴에 걸린다. 앞부분으로만 판정한다.
assert.equal(noiseReason('한국국학진흥원/KSI연수원'), null)
assert.equal(noiseReason('안동퇴계예던길/1코스'), null)

console.log(
  'ok — normalizeSpotName · nameSimilarity · distanceMeters · matchKorSpot(좌표 1순위) · keywordVariants · noiseReason',
)
