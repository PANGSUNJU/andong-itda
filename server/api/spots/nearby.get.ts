import type { Spot } from '#shared/types/tour'
import { walkMinutes } from '#shared/constants/location'

/**
 * 주변 관광지 — 좌표 기준 가까운 순
 *
 * 홈의 "걸어서 N분 안에" 띠가 쓰는 데이터다.
 * 거리 계산을 클라이언트로 넘기지 않는다. 넘기면 하버사인이 서버와 브라우저에
 * 두 벌 생기고, 두 곳의 반올림이 어긋나는 순간 화면과 정렬이 따로 논다.
 *
 * 캐시하지 않는다. 좌표가 사용자마다 다르다. 무거운 부분(관광지 목록)은
 * 내부 호출로 이미 1일 캐시된 것을 그대로 쓴다.
 */
export default defineEventHandler(async (event): Promise<Spot[]> => {
  const query = getQuery(event)
  const lat = Number(query.lat)
  const lng = Number(query.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || query.lat === '' || query.lng === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'lat, lng는 필수이며 숫자여야 한다',
    })
  }

  const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 64)

  /**
   * 반경 기본값 2km.
   *
   * "걸어서 다녀올 수 있는가"가 이 목록의 질문이므로 버스를 타야 하는 거리는
   * 제외한다. 다만 반경을 넓혀 달라는 요청은 받는다 — 외곽 관광지에 서 있는
   * 사용자에게는 2km 안에 아무것도 없을 수 있다.
   */
  const radius = Math.min(Math.max(Number(query.radius) || 2000, 100), 30_000)

  const spots = await $fetch<Spot[]>('/api/spots')

  return spots
    .map((spot) => {
      const distance = Math.round(distanceMeters(lat, lng, spot.lat, spot.lng))
      return { ...spot, distance, walkMinutes: walkMinutes(distance) }
    })
    .filter((spot) => spot.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
})
