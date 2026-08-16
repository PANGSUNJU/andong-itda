import type { BusStation, StationPin } from '#shared/types/bus'

import stationDirections from '../../data/station-directions.json'

/** 상류는 소수점 10자리를 준다. 5자리면 약 1m로 정류장 고르기에 충분하다. */
const round5 = (n: number) => Math.round(n * 1e5) / 1e5

/**
 * 방면과 기·종점 여부 — 미리 구워 둔 정적 데이터
 *
 * 상류에 없다. 노선 421개의 정류장 목록을 훑어야 나오므로 요청 시점에 만들지 않는다.
 * → `scripts/build-station-directions.ts`
 *
 * 실측(2026-08-13): 이걸 붙이면 응답이 164KB → 201KB(gzip 38KB → 47KB)다.
 * 이름이 겹치는 정류장이 1644곳이라 "겹치는 것만 붙이기"로 아껴 봐야 gzip 2KB다.
 * 나눠 붙일 이유가 없어 전부 붙인다.
 */
const directions: Record<string, string> = stationDirections.directions
const terminusOnly = new Set<number>(stationDirections.terminusOnly)

/**
 * 정류장 목록 — 원격 `?tab=1`
 *
 * 실측(2026-08-06): 상류 2107건 / 1,479KB. 아래 4필드만 남기면 153KB(gzip 31KB)다.
 * 브라우저가 이 목록을 통째로 받아 최근접 정류장을 직접 고른다.
 * 사용자 좌표를 서버로 보내지 않기 위해서다. → ADR-024
 *
 * 정류장 위치는 거의 변하지 않는다. 1일 캐시한다.
 *
 * useYn === 'N'은 폐지된 정류장이다. 2026-07-30 호출에서는 2107건이 전부
 * 'Y'였지만 필터는 유지한다. 상류가 조용히 바뀌는 편이,
 * 없는 정류장에 여행자를 세워두는 편보다 낫다.
 */
export default defineCachedEventHandler(
  async (): Promise<StationPin[]> => {
    const stations = await fetchBusApi<BusStation>('1')

    /**
     * ⚠️ 상류가 같은 stationId를 두 번 준다. 실측: 354000459 "안동역(안동터미널)"이
     *    중복 등장한다. 그대로 두면 같은 정류장이 목록에 두 줄로 나온다.
     *    캐시되는 여기서 한 번만 걸러 낸다.
     */
    const seen = new Set<number>()

    return stations
      .filter((station) => {
        if (station.useYn !== 'Y') return false
        if (seen.has(station.stationId)) return false
        seen.add(station.stationId)
        // 좌표가 없는 정류장은 거리 계산 대상이 아니다.
        return Number.isFinite(station.gpsY) && Number.isFinite(station.gpsX)
      })
      .map((station) => ({
        stationId: station.stationId,
        stationNm: station.stationNm,
        // 상류가 2107곳 전부 채워 준다. 버리지 않고 그대로 내보낸다.
        ...(station.stationEngNm?.trim() ? { nameEn: station.stationEngNm.trim() } : {}),
        lat: round5(station.gpsY),
        lng: round5(station.gpsX),
        // 없으면 없는 대로 둔다. 방면을 모르는 정류장에 이름을 지어내지 않는다.
        ...(directions[station.stationId] ? { direction: directions[station.stationId] } : {}),
        ...(terminusOnly.has(station.stationId) ? { terminusOnly: true } : {}),
      }))
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'bus-stations',
    // 쿼리 파라미터를 아무렇게나 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)
