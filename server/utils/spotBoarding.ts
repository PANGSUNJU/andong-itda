import type { StationPin } from '#shared/types/bus'
import type { RouteStationIndex, SpotBoarding } from '#shared/types/static-data'
import type { Spot } from '#shared/types/tour'

import routeStations from '../data/route-stations.json'
// 판정 자체는 순수 함수로 따로 둔다. 그래야 node로 회귀를 돌릴 수 있다.
import { computeBoarding, computeStopBoarding } from './boardingDirection'
import { reverseIndex, SPOT_RADIUS } from './spotRoutes'

/**
 * 목적지로 데려다주는 노선과 탈 수 있는 정류장
 *
 * 홈은 "212번 3분 후"까지 말한다. 목적지를 정한 사람이 정작 알아야 하는
 * "그게 내가 가려는 쪽인가"는 아직 말하지 못한다. 지금은 상세 화면에서 노선
 * 번호를 읽고 홈으로 돌아와 목록에서 눈으로 찾아야 한다 — 이 서비스가 없애려던
 * 두 화면 왕복이 서비스 안에 남아 있는 셈이다.
 *
 * `spotReach.ts`와 질문이 반대다. 저쪽은 **도착한 버스 → 닿는 관광지**를 붙이고
 * 사람이 확인한 매핑(7곳)에 기대므로 목적지 44곳에는 답하지 못한다. 이쪽은
 * **관광지 → 그리로 가는 노선**을 계산으로 구해 44곳 전부에 답한다.
 * 근거가 다르므로 파일도 화면 표기도 따로 둔다. → ADR-016의 연장
 *
 * ⚠️ **거르는 데 쓰라고 만든 값이 아니다.** 안동 외곽 노선은 배차가 하루
 *    3~13회다. 목적지행만 남기면 "표시할 버스 없음"이 기본 화면이 된다.
 *    기점 승강장을 지우지 않고 뒤로 보내기로 한 것과 같은 이유다(→ `index.vue`).
 *    화면은 이 값으로 **표시하고 정렬**한다.
 */
const index = routeStations as unknown as RouteStationIndex

export async function resolveSpotBoarding(spot: Spot): Promise<SpotBoarding> {
  /**
   * 우리 라우트를 부른다. 1일 캐시라 따뜻할 때 추가 원격 호출이 0이다.
   * 상류를 직접 부르면 그 캐시를 버린다. → `spotRoutes.ts`의 같은 판단
   */
  const stations = await $fetch<StationPin[]>('/api/bus/stations')
  return computeBoarding(spot, stations, reverseIndex(), index, SPOT_RADIUS)
}

/**
 * 정류장을 목적지로 — 안동역·터미널처럼 관광 API에 없는 곳
 *
 * 관광지와 같은 응답 모양(`SpotBoarding`)을 쓴다. 화면이 둘을 구분하지 않아도 되게
 * 하려는 것이다 — 목적지가 관광지든 정류장이든 여행자가 묻는 것은 같다.
 */
export async function resolveStopBoarding(stopName: string): Promise<SpotBoarding> {
  const stations = await $fetch<StationPin[]>('/api/bus/stations')
  return computeStopBoarding(stopName, stations, reverseIndex(), index)
}
