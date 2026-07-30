import type { BusRoute } from '#shared/types/bus'

/**
 * 노선 목록 — 원격 `?tab=3`
 *
 * 검증(2026-07-30 목 11:36): 421개 노선, 그중 runTotCnt > 0 인 노선 52개.
 *
 * runTotCnt(현재 운행 중인 차량 수)가 이 응답의 핵심이다.
 * 도착정보가 빈 배열일 때 "배차가 길어 대기 중"과 "오늘 운행 종료"를
 * 구분하는 유일한 근거다. 그래서 1분만 캐시한다.
 * 정류장 목록처럼 하루를 묵히면 운행이 끝난 노선을 운행 중으로 안내하게 된다.
 *
 * stTm/edTm/maxInterval/minInterval은 안동시가 입력하지 않아 전부 null로 온다.
 * 첫차·막차는 여기서 얻을 수 없고 정적 시간표(server/data)에서 가져온다. → ADR-016
 *
 * 폐지 노선 필터를 걸지 않는다. 2026-07-30 호출에서 421건이 모두 useYn 'Y'였고,
 * 노선은 routeId로 조회되므로 목록에 남아 있어도 화면에 새지 않는다.
 */
export default defineCachedEventHandler(
  async (): Promise<BusRoute[]> => fetchBusApi<BusRoute>('3'),
  {
    maxAge: 60, // 1분
    name: 'bus-routes',
    // 쿼리 파라미터를 아무렇게나 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)
