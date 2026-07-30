import type { BusArrival, BusRoute } from '#shared/types/bus'
import type { SpotBusInfo, SpotStationMap } from '#shared/types/static-data'

import spotStationMap from '../../data/spot-station-map.json'

/**
 * 관광지 통합 버스 정보 — 이 서비스의 핵심 엔드포인트
 *
 * 실시간 도착(tab=2) · 운행 여부(tab=3의 runTotCnt) · 정적 시간표를 한 번에 묶는다.
 * 세 소스가 각각 답하지 못하는 질문에 합쳐서 답하기 위한 조합이다.
 *   "지금 오는 버스가 있나"      → 도착정보
 *   "없는데, 기다리면 오나"      → runTotCnt
 *   "돌아오는 막차는 몇 시인가"   → 정적 시간표
 *
 * 캐시하지 않는다. 실시간성이 이 엔드포인트의 존재 이유다.
 *
 * ⚠️ schedule의 출처는 spot-station-map.json의 timetable이다.
 *    timetable-spots.json이 아니다. 후자는 엑셀 파싱 원본으로 구조가
 *    SpotTimetable과 맞지 않고(routes[].times[] + summary), 5개 관광지만 담으며
 *    (만휴정·임청각 없음, 월영교는 "안동댐·월영교"로 이름이 다름),
 *    summary.hasReturnTimetable이 큐레이션된 returnTimesKnown과 어긋난다.
 *    (주말 한정 급행2를 귀로 시간표로 세고, 도산서원 온혜발 귀로는 놓쳤다.)
 *    spot-station-map.json의 timetable이 그 원본을 손으로 정리한 결과이고
 *    타입상으로도 SpotTimetable 그 자체다. → ADR-016
 */
const map = spotStationMap as unknown as SpotStationMap

export default defineEventHandler(async (event): Promise<SpotBusInfo> => {
  const name = getRouterParam(event, 'spot', { decode: true }) ?? ''
  const entry = map.spots.find((candidate) => candidate.spot === name)

  if (!entry) {
    /**
     * pending은 "없는 관광지"가 아니라 "정류장을 아직 확인하지 못한 관광지"다.
     * 임의로 채우지 않기로 했으므로 404이지만, 둘을 구분해 알려준다. → ADR-016
     */
    throw createError({
      statusCode: 404,
      statusMessage: `버스 정보가 등록되지 않은 관광지: ${name}`,
      data: {
        pending: map.pending.some((candidate) => candidate.spot === name),
        available: map.spots.map((candidate) => candidate.spot),
      },
    })
  }

  /**
   * 도착정보 — /api/bus/arrivals와 같은 유틸을 그대로 쓴다.
   * 우리 라우트를 HTTP로 다시 부르지 않는다. 같은 함수를 부르면 끝이다.
   * 상류 실패 시 502도 그 유틸에서 함께 온다.
   */
  const { stationId } = entry.inbound
  const arrivals =
    stationId === null ? [] : (await fetchBusApi<BusArrival>('2', stationId)).sort(byPredictTm)

  /**
   * 노선 목록은 /api/bus/routes가 1분 캐시한다.
   * 여기서 원격을 직접 부르면 그 캐시를 버리고 매 요청마다 357KB를 다시 받는다.
   * 내부 호출로 캐시를 그대로 얻는다.
   */
  const routes = await $fetch<BusRoute[]>('/api/bus/routes')
  const route = routes.find((candidate) => candidate.routeId === entry.inbound.routeId)

  if (!route) {
    // 정적 매핑과 상류 노선 목록이 어긋난 상태다. 조용히 0으로 넘어가면
    // "오늘 운행 종료"로 표시되므로, 데이터를 고칠 수 있게 로그를 남긴다.
    console.warn(
      `[spot-bus] ${entry.spot}: 노선 ${entry.inbound.routeId}를 노선 목록에서 찾지 못했다`,
    )
  }

  const runTotCnt = route?.runTotCnt ?? 0

  return {
    spot: entry.spot,

    // stationId가 없으면 조회할 대상 자체가 없다. 빈 배열이 아니라 null이다.
    inbound:
      stationId === null
        ? null
        : {
            stationNm: entry.inbound.stationNm ?? '정류장명 미확인',
            // SpotBusInfo가 요구하는 네 필드만 남긴다. rstop·provideType 같은
            // 상류의 빈 필드를 화면까지 흘려보낼 이유가 없다.
            arrivals: arrivals.map((arrival) => ({
              routeNum: arrival.routeNum,
              via: arrival.via,
              predictTm: arrival.predictTm,
              remainStation: arrival.remainStation,
            })),
          },

    /**
     * 나가는 편은 항상 실시간이 없다. 기점 정류장에는 "접근 중인 차량"이라는
     * 개념이 성립하지 않는다. 검증: 하회 354002046 → [] → ADR-015
     * 같은 hasRealtime: false라도 사유가 둘로 갈리므로 구분해 담는다.
     */
    outbound: {
      hasRealtime: false,
      reason:
        entry.outbound.stationId === null
          ? '나가는 편 정류장ID를 아직 확인하지 못했다. 시간표로 안내한다.'
          : '기점 정류장이라 접근 중인 차량이 없다. 시간표와 운행 여부로 안내한다.',
    },

    /**
     * 시간표는 손대지 않고 그대로 내려보낸다.
     * returnTimesKnown이 false면 귀로 시각을 추정해 채우지 않는다.
     * 부정확한 막차 정보는 여행자를 정류장에 세워둔다. 판단은 화면이 한다.
     */
    schedule: entry.timetable,

    service: { runTotCnt, isOperating: runTotCnt > 0 },

    status: decideStatus(arrivals.length, runTotCnt),

    warning: entry.timetable.warning ?? null,
  }
})
