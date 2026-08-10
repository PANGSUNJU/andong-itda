import type { ArrivalWithSpots, BusArrival } from '#shared/types/bus'

/**
 * 정류장별 실시간 도착정보 — 원격 `?i={stationId}&tab=2`
 *
 * 캐시하지 않는다. 이 값은 분 단위로 바뀌고 화면 최상단 64px 자리에 놓이는
 * 유일한 실시간 정보다. 1분 묵은 "3분 후"는 정보가 아니라 거짓이다.
 *
 * ⚠️ 빈 배열은 오류가 아니라 정상 응답이다.
 *    기점 정류장에는 "접근 중인 차량"이라는 개념이 성립하지 않아 항상 []가 온다.
 *    검증(2026-07-30): 하회 354002046(나가는 편) → [] /
 *                      354000701(들어오는 편) → 풍천2 predictTm 1.0
 *    그래서 관광지에서 나가는 편은 실시간으로 잡을 수 없다.
 *    호출부는 []를 실패로 다루지 말고 노선 목록의 runTotCnt와 결합해
 *    "배차가 길어 대기 중"(runTotCnt > 0)과 "오늘 운행 종료"(runTotCnt = 0)를
 *    구분해야 한다. → ADR-015
 *
 * predictTm은 이미 분 단위로 계산되어 온다. 자체 계산 로직을 만들지 말 것.
 */
export default defineEventHandler(async (event): Promise<ArrivalWithSpots[]> => {
  const { stationId } = getQuery(event)

  /**
   * stationId는 필수다.
   * 없이 호출하면 원격이 빈 배열이나 엉뚱한 응답을 주는데, 그러면
   * "기점 정류장이라 비었다"와 구분할 수 없다. 여기서 끊는다.
   * 숫자가 아닌 값도 같이 막는다(반복 파라미터는 "1,2"가 되어 함께 걸린다).
   */
  if (!stationId || !/^\d+$/.test(String(stationId))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'stationId(정류장 ID, 숫자)가 필요하다',
      data: { received: stationId ?? null },
    })
  }

  const arrivals = await fetchBusApi<BusArrival>('2', String(stationId))

  /**
   * 도착 임박 순. predictTm이 null인 차량(위치 미확보)은 뒤로 밀린다.
   *
   * 정렬 뒤에 관광지를 붙인다. withSpots는 순서를 건드리지 않지만,
   * 도착 순서가 관광지 판정에 의존하지 않는다는 걸 코드 모양으로 남겨 둔다.
   * 관광지 순번은 1일 캐시되므로 이 실시간 경로에 상류 호출이 늘지 않는다.
   */
  return withSpots(arrivals.sort(byPredictTm))
})
