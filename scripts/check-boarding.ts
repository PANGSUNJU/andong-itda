/**
 * 목적지행 판정 회귀 검증 — `node scripts/check-boarding.ts`
 *
 * 이 판정이 틀리면 **여행자를 반대 방향 버스에 태운다.** 노선이 목적지를 지난다는
 * 사실만으로는 부족하고, 목적지가 내 정류장보다 뒤에 있어야 한다. 그 한 가지를 잡는다.
 *
 * 순수 함수라 상류도 캐시도 타지 않는다. 정류장과 노선 색인을 손으로 짜 넣는다.
 */
import assert from 'node:assert/strict'

import type { RouteStationIndex } from '../shared/types/static-data.ts'

import {
  computeBoarding,
  computeStopBoarding,
  type BoardingStation,
  type NamedStation,
} from '../server/utils/boardingDirection.ts'

/**
 * 가상의 한 줄 노선. 시내 → 목적지 → 그 너머로 이어진다.
 *
 *   순번  0      1      2       3(목적지)   4
 *   정류장 100    101    102     103        104
 *
 * 103 근처에 목적지가 있다. 100~102에서 타면 닿고, 104에서 타면 이미 지나쳤다.
 */
const ROUTE_ID = '9001'

const routeIndex: RouteStationIndex = {
  routes: {
    [ROUTE_ID]: {
      stations: [
        [100, 0],
        [101, 1000],
        [102, 2000],
        [103, 3000],
        [104, 4000],
      ],
      town: [0, 1],
    },
  },
}

/** 정류장 → [노선, 순번]. `reverseIndex()`가 만드는 것과 같은 모양이다. */
const lookup = new Map<number, [string, number][]>([
  [100, [[ROUTE_ID, 0]]],
  [101, [[ROUTE_ID, 1]]],
  [102, [[ROUTE_ID, 2]]],
  [103, [[ROUTE_ID, 3]]],
  [104, [[ROUTE_ID, 4]]],
])

/** 목적지는 103 바로 옆(수 m). 나머지는 위경도로 멀찍이 떨어뜨린다. */
const DEST = { name: '가상목적지', lat: 36.5, lng: 128.5 }

/** `spotRoutes.SPOT_RADIUS`와 같은 값. 여기서 손으로 넣는 이유는 그 파일이 400KB JSON을 들여오기 때문이다. */
const RADIUS = 1300

const stations: BoardingStation[] = [
  { stationId: 100, lat: 36.4, lng: 128.4 }, // 약 14km — 반경 밖
  { stationId: 101, lat: 36.45, lng: 128.45 }, // 약 7km — 반경 밖
  { stationId: 102, lat: 36.48, lng: 128.48 }, // 약 2.8km — 반경 밖
  { stationId: 103, lat: 36.5001, lng: 128.5001 }, // 목적지 바로 옆
  { stationId: 104, lat: 36.52, lng: 128.52 }, // 약 2.8km — 반경 밖
]

const result = computeBoarding(DEST, stations, lookup, routeIndex, RADIUS)

// 목적지 옆 정류장(103)이 하차 지점으로 잡혀야 한다.
assert.equal(result.routes.length, 1, '노선 하나가 잡혀야 한다')
assert.equal(result.routes[0]!.routeId, 9001)
/**
 * ⚠️ 이 한 줄이 off-by-one을 막는다.
 *
 * 103은 배열 **인덱스 3**이고, 상류 `stationOrd`는 1부터 세므로 **4**다. 인덱스를
 * 그대로 내보내면 화면의 `arrival.stationOrd < destOrd` 비교에서 **바로 다음
 * 정거장이 목적지인 버스가 탈락한다** — 가장 먼저 타야 할 차가 빠진다.
 *
 * 실측(2026-09-16): 노하동입구(ord 38)에서 110번의 다음 정거장이 안동역인데
 * (인덱스 38 = ord 39), 인덱스로 재면 `38 < 38`이라 "목적지행 아님"이 됐다.
 * 화면에는 "110번이 곧 도착해요 · 안동역 방면" 바로 아래 "지금 오는 차 중에는
 * 안동역 방면이 없어요"가 함께 떴다.
 */
assert.equal(result.routes[0]!.destOrd, 4, '상류 눈금(1부터)이다. 인덱스 3 → ord 4')

// 바로 앞 정거장(인덱스 2 = ord 3)에서 오는 버스가 목적지행으로 판정돼야 한다.
assert.ok(3 < result.routes[0]!.destOrd, '한 정거장 앞에서 오는 차가 탈락하면 안 된다')
assert.equal(result.routes[0]!.stationId, 103, '하차 정류장은 목적지에 가장 가까운 103이다')
assert.ok(result.routes[0]!.walkMeters < 30, '하차 정류장은 목적지 바로 옆이다')

const boarding = new Set(result.boardingStations)

// ⚠️ 이 네 줄이 이 파일의 이유다.
assert.ok(boarding.has(100), '목적지보다 앞선 정류장에서는 탈 수 있어야 한다')
assert.ok(boarding.has(101), '목적지보다 앞선 정류장에서는 탈 수 있어야 한다')
assert.ok(boarding.has(102), '목적지보다 앞선 정류장에서는 탈 수 있어야 한다')
assert.ok(!boarding.has(104), '목적지를 지난 정류장에서 타면 반대 방향이다')

// 하차 정류장 자신은 담기지 않는다. 거기서 타는 건 이미 도착한 사람이다.
assert.ok(!boarding.has(103), '하차 정류장 자신은 승차 후보가 아니다')

/**
 * 순환 노선 — 같은 정류장이 앞뒤로 두 번 나온다.
 *
 *   순번  0    1    2(목적지)   3    4
 *   정류장 200  201  202        203  200   ← 200이 다시 나온다
 *
 * 200은 앞에도 있으므로 담겨야 한다. 거기서 타면 실제로 목적지에 닿는다.
 * 203은 뒤에만 있으므로 담기면 안 된다.
 */
const LOOP_ID = '9002'

const loopIndex: RouteStationIndex = {
  routes: {
    [LOOP_ID]: {
      stations: [
        [200, 0],
        [201, 1000],
        [202, 2000],
        [203, 3000],
        [200, 4000],
      ],
      town: [0],
    },
  },
}

const loopLookup = new Map<number, [string, number][]>([
  [
    200,
    [
      [LOOP_ID, 0],
      [LOOP_ID, 4],
    ],
  ],
  [201, [[LOOP_ID, 1]]],
  [202, [[LOOP_ID, 2]]],
  [203, [[LOOP_ID, 3]]],
])

const loopResult = computeBoarding(
  DEST,
  [
    { stationId: 200, lat: 36.4, lng: 128.4 },
    { stationId: 201, lat: 36.45, lng: 128.45 },
    { stationId: 202, lat: 36.5001, lng: 128.5001 }, // 목적지 옆
    { stationId: 203, lat: 36.52, lng: 128.52 },
  ],
  loopLookup,
  loopIndex,
  RADIUS,
)

const loopBoarding = new Set(loopResult.boardingStations)
assert.equal(loopResult.routes[0]!.destOrd, 3, '인덱스 2 → 상류 ord 3')
assert.ok(loopBoarding.has(200), '순환 노선에서 앞에 한 번 나오면 탈 수 있다')
assert.ok(loopBoarding.has(201), '목적지보다 앞선 정류장')
assert.ok(!loopBoarding.has(203), '목적지를 지난 뒤에만 나오는 정류장은 담기지 않는다')

/**
 * 반경 밖 목적지 — 근처에 정류장이 없으면 노선도 없다.
 *
 * 빈 배열이 "직행이 없다"는 뜻이고, 화면은 그걸 "갈 수 없다"와 다르게 말해야 한다.
 * 환승은 아직 계산하지 않기 때문이다.
 */
const farResult = computeBoarding(
  { name: '멀리', lat: 37.5, lng: 127.0 }, // 서울
  stations,
  lookup,
  routeIndex,
  RADIUS,
)
assert.equal(farResult.routes.length, 0, '반경 안에 정류장이 없으면 노선이 없다')
assert.equal(farResult.boardingStations.length, 0)

/**
 * 정류장을 목적지로 — 같은 이름의 승강장이 여럿인 경우
 *
 *   노선 A(9101)  300 → 301 → **310(안동역)** → 302
 *   노선 B(9102)  303 → **311(안동역)** → 304
 *
 * 310·311은 이름이 같은 다른 승강장이다. 둘을 함께 목적지로 봐야 두 노선이 모두 잡힌다.
 * 승강장 하나로 고정하면 다른 승강장에 서는 노선이 통째로 빠진다.
 */
const A = '9101'
const Bx = '9102'

const stopIndex: RouteStationIndex = {
  routes: {
    [A]: {
      stations: [
        [300, 0],
        [301, 1000],
        [310, 2000],
        [302, 3000],
      ],
      town: [0],
    },
    [Bx]: {
      stations: [
        [303, 0],
        [311, 1000],
        [304, 2000],
      ],
      town: [0],
    },
  },
}

const stopLookup = new Map<number, [string, number][]>([
  [300, [[A, 0]]],
  [301, [[A, 1]]],
  [310, [[A, 2]]],
  [302, [[A, 3]]],
  [303, [[Bx, 0]]],
  [311, [[Bx, 1]]],
  [304, [[Bx, 2]]],
])

const stopStations: NamedStation[] = [
  { stationId: 300, stationNm: '가', lat: 36.4, lng: 128.4 },
  { stationId: 301, stationNm: '나', lat: 36.41, lng: 128.41 },
  { stationId: 310, stationNm: '안동역', lat: 36.5, lng: 128.5 },
  { stationId: 302, stationNm: '다', lat: 36.51, lng: 128.51 },
  { stationId: 303, stationNm: '라', lat: 36.42, lng: 128.42 },
  { stationId: 311, stationNm: '안동역', lat: 36.5001, lng: 128.5001 },
  { stationId: 304, stationNm: '마', lat: 36.52, lng: 128.52 },
]

const stopResult = computeStopBoarding('안동역', stopStations, stopLookup, stopIndex)
const stopBoarding = new Set(stopResult.boardingStations)

assert.equal(stopResult.spot, '안동역')
assert.equal(stopResult.routes.length, 2, '같은 이름 승강장 둘에 서는 노선이 모두 잡혀야 한다')
assert.deepEqual(
  stopResult.routes.map((r) => r.destOrd).sort(),
  [2, 3],
  '상류 눈금(1부터). 노선 A는 인덱스 2 → ord 3, 노선 B는 인덱스 1 → ord 2',
)
assert.ok(
  stopResult.routes.every((route) => route.walkMeters === 0),
  '목적지가 정류장 자신이면 내려서 걸을 거리가 없다',
)

// 두 노선 각각에서 목적지보다 앞선 정류장이 승차 후보다.
assert.ok(stopBoarding.has(300) && stopBoarding.has(301), '노선 A의 앞선 정류장')
assert.ok(stopBoarding.has(303), '노선 B의 앞선 정류장')
assert.ok(!stopBoarding.has(302), '노선 A에서 목적지를 지난 정류장')
assert.ok(!stopBoarding.has(304), '노선 B에서 목적지를 지난 정류장')

// ⚠️ 같은 이름의 다른 승강장에서 타라고 하지 않는다. 거기 선 사람은 이미 도착했다.
assert.ok(!stopBoarding.has(310), '목적지 승강장 자신은 승차 후보가 아니다')
assert.ok(!stopBoarding.has(311), '같은 이름의 다른 승강장도 승차 후보가 아니다')

/** 없는 이름이면 아무것도 나오지 않는다. 화면은 이 상태를 404로 받는다. */
const noStop = computeStopBoarding('없는정류장', stopStations, stopLookup, stopIndex)
assert.equal(noStop.routes.length, 0)
assert.equal(noStop.boardingStations.length, 0)

console.log(
  '✓ 목적지행 판정 회귀 통과 — 순번 비교·순환 노선·직행 없음·정류장 목적지(동명 승강장) 모두 확인',
)
