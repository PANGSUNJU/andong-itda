/**
 * 관광지 매칭 로직 회귀 검증 — `node scripts/check-spot-match.ts`
 *
 * 두 API에 공통 키가 없어 좌표+이름으로 같은 장소를 판정한다.
 * 잘못 붙으면 하회마을 카드에 탈박물관 사진이 걸린다. 그 회귀를 잡는다.
 */
import assert from 'node:assert/strict'

import { distanceMeters, nearest } from '../shared/constants/location.ts'
import { clusterPlaces, spanOf } from '../server/utils/walkAreas.ts'
import {
  foodCategoryOf,
  keywordVariants,
  matchKorSpot,
  nameSimilarity,
  noiseReason,
  normalizeSpotName,
  pickByName,
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

/**
 * nearest — 거리순 · 반경 컷 · 개수 제한
 *
 * 홈의 주변 정류장과 주변 관광지가 전부 이 함수 하나로 돈다. 서버가 아니라
 * 브라우저에서 도는 계산이라(→ ADR-024) 여기가 깨지면 화면이 통째로 틀린다.
 */
const ANDONG_STATION = { lat: 36.57349, lng: 128.67566 }
const places = [
  { id: 'wolyeong', lat: 36.576597, lng: 128.760922 }, // 안동역에서 약 7.6km
  { id: 'hahoe', lat: 36.539062, lng: 128.517994 }, // 약 14.6km
  { id: 'here', lat: 36.57349, lng: 128.67566 }, // 0m
]

assert.deepEqual(
  nearest(places, ANDONG_STATION).map((place) => place.id),
  ['here', 'wolyeong', 'hahoe'],
)
assert.equal(nearest(places, ANDONG_STATION)[0]!.distance, 0)
// 0m라도 walkMinutes는 최소 1분이다. "걸어서 0분"은 문장이 되지 않는다.
assert.equal(nearest(places, ANDONG_STATION)[0]!.walkMinutes, 1)

// 반경 밖은 자른다. 하회마을(14.6km)만 빠져야 한다.
assert.deepEqual(
  nearest(places, ANDONG_STATION, { radius: 10_000 }).map((place) => place.id),
  ['here', 'wolyeong'],
)
assert.equal(nearest(places, ANDONG_STATION, { limit: 1 }).length, 1)
assert.equal(nearest([], ANDONG_STATION).length, 0)

// 원본을 정렬하지 않는다. 홈은 같은 관광지 배열을 순위순과 거리순으로 동시에 쓴다.
assert.equal(places[0]!.id, 'wolyeong')

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

/* 이름 매칭(2·3차) — 좌표 200m 게이트가 놓친 것을 이름으로 잡는다 */

// 아래 넷은 2026-08-23 실제 응답의 값이다.
const hahoeSpot = { id: 'h', name: '안동하회마을', lat: 36.539062, lng: 128.517994 } as never
const hahoeMain = kor('안동 하회마을 [유네스코 세계유산]', '128.5282935032', '36.5506148855', '894027')
const gyeomam = kor('안동 하회마을 겸암정사', '128.5132518279', '36.5426946970', '1180879')
const withImage = (k: never) => ({ ...(k as object), firstimage: 'https://x/y.jpg' }) as never

/**
 * **거리가 아니라 이름이 이긴다.**
 * 겸암정사가 585m로 더 가깝고 본체는 1,580m로 더 멀다. 거리로 고르면 하회마을
 * 카드에 겸암정사 사진이 걸린다. 유사도 1.00(본체) > 0.9(겸암정사)로 갈려야 한다.
 * 2차 로컬 매칭이 존재하는 이유가 바로 이 한 건이다. → ADR-034
 */
assert.equal(pickByName(hahoeSpot, [withImage(gyeomam), withImage(hahoeMain)])?.contentid, '894027')
// 순서를 뒤집어도 같다. 배열 순서에 의존하면 상류가 순서를 바꿀 때 조용히 뒤집힌다.
assert.equal(pickByName(hahoeSpot, [withImage(hahoeMain), withImage(gyeomam)])?.contentid, '894027')

// 본체가 없으면 겸암정사도 붙지 않는다. 포함관계(0.9)의 반경은 500m인데 585m다.
assert.equal(pickByName(hahoeSpot, [withImage(gyeomam)]), null)

// 이미지 없는 후보는 애초에 볼 이유가 없다. 이 단계의 목적이 이미지다.
assert.equal(pickByName(hahoeSpot, [hahoeMain]), null)

// 완전일치라도 3km를 넘으면 다른 곳이다. 실측: CGV/안동의 최근접 후보가 185km였다.
assert.equal(pickByName(hahoeSpot, [withImage(kor('하회마을', '128.6', '36.6', '9'))]), null)

/* 키워드 보충 — 풀에도 없는 항목을 전국에서 찾을 때 쓰는 검색어 */

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

/* 음식점 분류 — ADR-023. 아래 이름은 전부 2026-08-02 실제 응답의 title이다. */

/**
 * 두 분류 필드를 다 받는다. 법정동 코드로 조회한 레코드는 `cat3`가 비어서 오고
 * `lclsSystm2`만 채워진다(실측 2026-09-10). 옛 레코드는 그 반대가 아니라 둘 다
 * 채워져 온다. 그래서 이 픽스처는 한쪽만 있는 경우를 각각 만들어 본다. → ADR-039
 */
const food = (title: string, cat3: string, lclsSystm2 = '') =>
  ({ title, cat3, lclsSystm2 }) as never

// 이름이 스스로 밝히는 것만 태깅한다.
assert.equal(foodCategoryOf(food('안동 유진찜닭', 'A05020100')), '찜닭')
// 상호 표기는 '헛제사밥'이고 분류명은 '헛제삿밥'이다. 둘을 잇지 못하면 0건짜리 칩이 남는다.
assert.equal(foodCategoryOf(food('맛50년 헛제사밥', 'A05020100')), '헛제삿밥')
assert.equal(foodCategoryOf(food('헛제사밥까치구멍집', 'A05020100')), '헛제삿밥')

// 간고등어집이지만 이름에 없다. '한식'으로 남는 게 맞다.
// 여기를 '간고등어'로 바꾸고 싶어지면 그 근거가 응답 밖에 있다는 뜻이다. → ADR-023
assert.equal(foodCategoryOf(food('옥야식당', 'A05020100')), '한식')
assert.equal(foodCategoryOf(food('일직식당', 'A05020100')), '한식')
assert.equal(foodCategoryOf(food('안동한우갈비', 'A05020100')), '한식')

// 카페는 API가 직접 답한 것이라 이름 추측보다 앞선다.
assert.equal(foodCategoryOf(food('맘모스베이커리', 'A05020900')), '카페')
assert.equal(foodCategoryOf(food('396커피컴퍼니', 'A05020900')), '카페')
// 상류가 새 cat3를 보내와도 목록에서 사라지지 않는다. 모르는 값은 한식으로 둔다.
assert.equal(foodCategoryOf(food('언젠가 생길 국숫집', 'A05029999')), '한식')

/**
 * ⚠️ 법정동 조회 레코드는 `cat3`가 빈 문자열이다. `cat3`만 보던 시절 아래 셋이
 *    카페인데 한식으로 분류됐다. 실제 응답의 title과 lclsSystm2다. → ADR-039
 */
assert.equal(foodCategoryOf(food('브레드 79', '', 'FD05')), '카페')
assert.equal(foodCategoryOf(food('아차가', '', 'FD05')), '카페')
assert.equal(foodCategoryOf(food('월영당', '', 'FD05')), '카페')

// 같은 조회로 들어온 한식·찜닭은 그대로 갈린다. 찜닭이 1곳에서 6곳이 된 자리다.
assert.equal(foodCategoryOf(food('중앙찜닭', '', 'FD01')), '찜닭')
assert.equal(foodCategoryOf(food('원조안동찜닭 본점', '', 'FD01')), '찜닭')
assert.equal(foodCategoryOf(food('경상도추어탕', '', 'FD01')), '한식')

// 옛 레코드는 둘 다 채워져 온다. 한쪽만 봐도 같은 답이어야 한다.
assert.equal(foodCategoryOf(food('맘모스베이커리', 'A05020900', 'FD05')), '카페')
assert.equal(foodCategoryOf(food('농가맛집 뜰', 'A05020100', 'FD01')), '한식')

/* 걸어서 이어지는 동네 — ADR-043 */

/** 위도 1도 ≒ 111km. 미터를 대충 위도로 바꿔 픽스처를 만든다. */
const at = (name: string, north: number, east = 0) => ({
  name,
  lat: 36.56 + north / 111_320,
  lng: 128.72 + east / 90_000,
})

/**
 * A–B가 이어지고 B–C가 이어지면 A–C가 멀어도 한 묶음이다.
 * 걸어서 오가는 동네가 실제로 그런 모양이라 연결 요소로 묶는다.
 */
const chain = clusterPlaces([at('A', 0), at('B', 700), at('C', 1400)], 800, 3)
assert.equal(chain.length, 1)
assert.equal(chain[0]!.length, 3)

// 800m를 넘으면 끊긴다. 끊긴 조각이 3곳 미만이면 아예 버린다.
const broken = clusterPlaces([at('A', 0), at('B', 700), at('C', 3000)], 800, 3)
assert.equal(broken.length, 0)

// 3곳 미만은 "동네"가 아니다. 둘은 그냥 옆집이다.
assert.equal(clusterPlaces([at('A', 0), at('B', 100)], 800, 3).length, 0)

/**
 * 폭은 **가장 먼 두 지점** 사이다. 이어진 사슬의 폭이 연결 거리보다 크다는 것이
 * 이 값의 존재 이유다 — 16곳짜리 시내 묶음은 폭이 2.7km라 한 번에 도는 곳이 아니다.
 */
const span = spanOf([at('A', 0), at('B', 700), at('C', 1400)])
assert.ok(Math.abs(span - 1400) < 20, `폭 ${span}m`)

console.log(
  'ok — normalizeSpotName · nameSimilarity · distanceMeters · nearest(거리순·반경·개수) · matchKorSpot(좌표 1순위) · pickByName(이름 1순위) · keywordVariants · noiseReason · foodCategoryOf · clusterPlaces(연결 요소·최소 개수) · spanOf',
)
