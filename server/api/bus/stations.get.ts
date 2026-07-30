import type { BusStation } from '#shared/types/bus'

/**
 * 정류장 전체 목록 — 원격 `?tab=1`
 *
 * 검증(2026-07-30): 2107건 / 약 1.4MB.
 *
 * 정류장 위치는 거의 변하지 않는다. 매 요청마다 1.4MB를 다시 받아올 이유가
 * 없어 1일 캐시한다. 좌표 기반 "주변 정류장" 계산의 원본이 되는 데이터다.
 *
 * useYn === 'N'은 폐지된 정류장이다. 2026-07-30 호출에서는 2107건이 전부
 * 'Y'였지만 필터는 유지한다. 상류가 조용히 바뀌는 편이,
 * 없는 정류장에 여행자를 세워두는 편보다 낫다.
 */
export default defineCachedEventHandler(
  async (): Promise<BusStation[]> => {
    const stations = await fetchBusApi<BusStation>('1')
    return stations.filter((station) => station.useYn === 'Y')
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'bus-stations',
    // 쿼리 파라미터를 아무렇게나 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)
