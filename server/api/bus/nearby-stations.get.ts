import type { BusStation, NearbyStation } from '#shared/types/bus'
import { walkMinutes } from '#shared/constants/location'

/**
 * 주변 정류장 — 좌표 기준 최근접 N개
 *
 * 정류장 전체는 2107건 1.86MB다. 브라우저로 내려보내 거기서 최근접을 고르면
 * 홈 화면 첫 로딩에 2MB를 쓴다. 거리 계산을 서버에서 끝내고 5건만 보낸다.
 *
 * 캐시하지 않는다. 좌표가 사용자마다 다르므로 캐시 적중률이 사실상 0이고,
 * 무거운 부분(정류장 목록)은 내부 호출로 이미 1일 캐시된 것을 그대로 쓴다.
 */
export default defineEventHandler(async (event): Promise<NearbyStation[]> => {
  const query = getQuery(event)
  const lat = Number(query.lat)
  const lng = Number(query.lng)

  // Number('')은 0이다. 빈 파라미터를 적도 좌표로 오해하지 않도록 함께 막는다.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || query.lat === '' || query.lng === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'lat, lng는 필수이며 숫자여야 한다',
    })
  }

  const limit = Math.min(Math.max(Number(query.limit) || 5, 1), 20)

  /**
   * 우리 라우트를 내부 호출한다. 원격을 직접 부르면 stations.get.ts의
   * 1일 캐시를 버리고 매 요청마다 1.86MB를 다시 받는다.
   */
  const stations = await $fetch<BusStation[]>('/api/bus/stations')

  /**
   * ⚠️ 상류가 같은 stationId를 두 번 준다. 실측: 354000459 "안동역(안동터미널)"이
   *    중복 등장한다. 그대로 두면 같은 정류장이 목록에 두 줄로 나온다.
   */
  const seen = new Set<number>()

  return stations
    .filter((station) => {
      if (seen.has(station.stationId)) return false
      seen.add(station.stationId)
      // 좌표가 없는 정류장은 거리 계산 대상이 아니다.
      return Number.isFinite(station.gpsY) && Number.isFinite(station.gpsX)
    })
    .map((station) => {
      const distance = Math.round(distanceMeters(lat, lng, station.gpsY, station.gpsX))
      return {
        stationId: station.stationId,
        stationNm: station.stationNm,
        gpsX: station.gpsX,
        gpsY: station.gpsY,
        distance,
        walkMinutes: walkMinutes(distance),
      }
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
})
