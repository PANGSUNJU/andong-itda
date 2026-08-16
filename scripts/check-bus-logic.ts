/**
 * 버스 판정 로직 회귀 검증 — `node scripts/check-bus-logic.ts`
 *
 * 화면 문구가 갈리는 세 지점만 잡는다. 테스트 프레임워크를 붙이지 않았다.
 *   byPredictTm      — null(위치 미확보) 차량이 "곧 도착"으로 올라오는 회귀
 *   decideStatus     — 운행 중인데 "오늘 운행 종료"라고 말하는 회귀
 *   deriveDirections — 같은 이름 승강장을 가르는 "방면"이 제 이름으로 되돌아오는 회귀
 */
import assert from 'node:assert/strict'

import type { BusRouteStation } from '../shared/types/bus.ts'
import { byPredictTm, decideStatus } from '../server/utils/andongBus.ts'
import { formatDirection } from '../app/utils/format.ts'
import { deriveDirections } from './build-station-directions.ts'

const order = (values: (number | null)[]) =>
  values
    .map((predictTm) => ({ predictTm }))
    .sort(byPredictTm)
    .map((arrival) => arrival.predictTm)

assert.deepEqual(order([25, 1, 12]), [1, 12, 25])
assert.deepEqual(order([null, 3, null, 1]), [1, 3, null, null]) // null은 항상 뒤
assert.deepEqual(order([null, null]), [null, null])
assert.deepEqual(order([]), [])

// 도착정보가 있으면 runTotCnt가 무엇이든 arriving이다.
assert.equal(decideStatus(1, 1), 'arriving')
assert.equal(decideStatus(2, 0), 'arriving')
// 빈 배열의 의미는 runTotCnt가 가른다. 이 두 줄이 뒤집히면 여행자가
// 오지 않는 버스를 기다리거나, 오는 버스를 두고 돌아간다.
assert.equal(decideStatus(0, 4), 'waiting')
assert.equal(decideStatus(0, 0), 'closed')

/**
 * 방면 — 안동터미널 모양을 그대로 줄인 것이다.
 * 407·536은 이름이 같은 승강장 두 개, 그 다음이 진짜 방면이다.
 */
const stop = (stationId: number, stationNm: string): BusRouteStation =>
  ({ stationId, stationNm }) as BusRouteStation

const 나가는편 = [
  stop(416, '안동역(안동터미널)'),
  stop(459, '안동역(안동터미널)'),
  stop(700, '송야교사거리'),
]
// 되돌아와 416에서 운행을 마친다. 416은 어느 노선에서도 중간에 놓이지 않는다.
const 들어오는편 = [
  stop(900, '옥동'),
  stop(700, '송야교사거리'),
  stop(459, '안동역(안동터미널)'),
  stop(416, '안동역(안동터미널)'),
]

const { directions, terminusOnly } = deriveDirections([나가는편, 들어오는편])

// 바로 다음이 같은 이름이면 건너뛴다. 이게 깨지면 "안동역 방면 안동역"이 화면에 뜬다.
assert.equal(directions['416'], '송야교사거리')
assert.equal(directions['459'], '송야교사거리')

// 노선 중간에 한 번도 놓이지 않은 승강장 = 도착정보가 영영 오지 않는 곳.
// 이 판정이 뒤집히면 오지 않을 버스를 기다리게 하거나, 멀쩡한 승강장을 뒤로 민다.
assert.equal(terminusOnly.includes(416), true)
assert.equal(terminusOnly.includes(459), false)

/**
 * 방면 — 상류가 종점을 줄 때와 안 줄 때
 *
 * 실측(2026-08-14): 표본 50건이 전부 종점 없이 왔다. 그대로 뱉으면 화면에
 * "청호한우촌앞 -> · 11정거장 전"이 남는다. 이 세 줄이 그 회귀를 막는다.
 */
assert.equal(formatDirection('교보생명 -> 하회마을'), '하회마을 방면')
assert.equal(
  formatDirection('만휴정 -> ', '610(만휴정-길안-국립경국대-교보건너-안동터미널)'),
  '안동터미널 방면',
)
// 상류가 via를 다시 채우면 via가 이긴다.
assert.equal(formatDirection('도청 -> 임하', '212(도청-국립경국대)'), '임하 방면')
// 건질 데가 없으면 빈 문자열이다. 화살표 조각을 사람에게 보여주지 않는다.
assert.equal(formatDirection('청호한우촌앞 -> '), '')
assert.equal(formatDirection('청호한우촌앞 -> ', '110'), '')

console.log(
  'ok — byPredictTm (오름차순, null 후순위) · decideStatus (arriving/waiting/closed) · deriveDirections (같은 이름 건너뛰기, 기·종점 전용) · formatDirection (via 우선, routeNm 폴백, 없으면 빈 문자열)',
)
