/**
 * 버스 판정 로직 회귀 검증 — `node scripts/check-bus-logic.ts`
 *
 * 화면 문구가 갈리는 두 지점만 잡는다. 테스트 프레임워크를 붙이지 않았다.
 *   byPredictTm  — null(위치 미확보) 차량이 "곧 도착"으로 올라오는 회귀
 *   decideStatus — 운행 중인데 "오늘 운행 종료"라고 말하는 회귀
 */
import assert from 'node:assert/strict'

import { byPredictTm, decideStatus } from '../server/utils/andongBus.ts'

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

console.log('ok — byPredictTm (오름차순, null 후순위) · decideStatus (arriving/waiting/closed)')
