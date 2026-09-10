import type { WalkPlace } from '#shared/types/tour'

// 별칭이 아니라 상대경로다. `scripts/*.ts`를 node로 직접 돌릴 때 별칭은 해석되지
// 않는다. → `tourApi.ts`의 같은 주석
import { distanceMeters } from '../../shared/constants/location.ts'

/**
 * 걸어서 이어지는 묶음 — 순수 함수만 둔다
 *
 * ADR-008은 "걷기 코스를 공공 API에서 가져올 수 없다"고 적었다. 두루누비에 안동이
 * 없는 것은 지금도 맞고, 여행코스(contentTypeId=25)도 안동은 1건뿐이며 그마저
 * 1박2일 차량 코스다(실측 2026-09-11, 옛 조회·법정동 조회 둘 다 1건).
 *
 * 그런데 **코스가 없다는 것과 재료가 없다는 것은 다르다.** 관광지·문화시설 133곳의
 * 좌표를 이으면 걸어서 오갈 수 있는 묶음이 나온다. 그건 우리가 지어내는 것이
 * 아니라 좌표가 말하는 사실이다. → ADR-043
 *
 * ⚠️ 묶음은 **코스가 아니다.** 순서도 소요 시간도 말하지 않는다.
 *
 * 회귀 검증: `node scripts/check-spot-match.ts`
 */

/**
 * 두 지점을 "이어졌다"고 볼 거리(m)
 *
 * 800m는 도보 12분쯤이다. 더 늘리면 시내가 통째로 한 덩어리가 되어 "동네"라는
 * 말이 무의미해지고, 더 줄이면 실제로 걸어 다니는 구간이 갈라진다.
 * 실측(2026-09-11): 800m에서 3곳 이상 묶음이 12개, 가장 큰 것이 16곳이다.
 */
export const LINK_METERS = 800

/** 이보다 적으면 "동네"라고 부르지 않는다. 둘은 그냥 옆집이다. */
export const MIN_PLACES = 3

/**
 * 좌표로 이어진 덩어리를 찾는다 — 연결 요소(connected component)
 *
 * A–B가 이어지고 B–C가 이어지면 A–C가 멀어도 한 묶음이다. 걸어서 오가는 동네가
 * 실제로 그런 모양이기 때문이다. 그래서 묶음의 최대 폭은 따로 알려 준다 —
 * 16곳짜리 시내 묶음은 폭이 2.7km라 한 번에 다 도는 곳이 아니다.
 */
export function clusterPlaces(
  places: WalkPlace[],
  linkMeters = LINK_METERS,
  minPlaces = MIN_PLACES,
): WalkPlace[][] {
  const seen = new Set<number>()
  const clusters: WalkPlace[][] = []

  for (let start = 0; start < places.length; start++) {
    if (seen.has(start)) continue

    const queue = [start]
    const group: WalkPlace[] = []
    seen.add(start)

    while (queue.length) {
      const index = queue.pop()!
      const here = places[index]!
      group.push(here)

      for (let other = 0; other < places.length; other++) {
        if (seen.has(other)) continue
        const there = places[other]!
        if (distanceMeters(here.lat, here.lng, there.lat, there.lng) > linkMeters) continue
        seen.add(other)
        queue.push(other)
      }
    }

    if (group.length >= minPlaces) clusters.push(group)
  }

  return clusters
}

/** 묶음 안 가장 먼 두 지점 사이 거리(m). 한 번에 도는 곳인지를 이 값이 말한다. */
export function spanOf(places: WalkPlace[]): number {
  let span = 0

  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const a = places[i]!
      const b = places[j]!
      span = Math.max(span, distanceMeters(a.lat, a.lng, b.lat, b.lng))
    }
  }

  return Math.round(span)
}

/** 묶음의 중심. 지도에 점 하나로 찍을 때 쓴다. */
export function centerOf(places: WalkPlace[]): { lat: number; lng: number } {
  const lat = places.reduce((sum, place) => sum + place.lat, 0) / places.length
  const lng = places.reduce((sum, place) => sum + place.lng, 0) / places.length
  return { lat, lng }
}
