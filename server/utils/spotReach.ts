import type { ArrivalWithSpots, BusArrival, BusRouteStation } from '#shared/types/bus'
import type { SpotStationMap } from '#shared/types/static-data'

import spotStationMap from '../data/spot-station-map.json'

/**
 * 도착 버스 → 그 버스가 닿는 관광지
 *
 * 홈은 "212번 12분 후"까지만 말하고 그 버스가 어디로 가는지는 말하지 못했다.
 * 화면에 있던 `via`는 노선의 기점 → 종점이라, 종점이 관광지일 때만 우연히
 * 읽혔다. 이 파일이 그 구멍을 메운다. → ADR-025
 *
 * ⚠️ routeId 일치만으로 판정하지 않는다.
 *    같은 노선이어도 내 정류장이 관광지보다 뒤면 그 버스는 이미 지나쳤다.
 *    "→ 하회마을"을 잘못 붙이면 여행자를 반대 방향 버스에 태운다.
 *    노선상 순번을 비교해 앞선 경우만 담는다. → ADR-015·ADR-016의 연장
 */
const map = spotStationMap as unknown as SpotStationMap

interface SpotReach {
  spot: string
  routeId: number
  /** 관광지 정류장의 노선상 순번 */
  stationOrd: number
}

/**
 * 관광지별 노선상 순번 — 미기재분만 `tab=4`로 채운다
 *
 * spot-station-map.json에 stationOrd가 있는 것은 7곳 중 2곳(월영교·임청각)뿐이다.
 * 나머지는 노선별 정류장 목록에서 stationId로 찾아 채운다.
 *
 * 1일 캐시한다. 노선의 정류장 순서는 시간표만큼도 자주 바뀌지 않는다.
 * 캐시가 비면 노선 수만큼 상류를 부르므로 캐시가 특히 중요하다.
 */
const resolveSpotReaches = defineCachedFunction(
  async (): Promise<SpotReach[]> => {
    const targets = map.spots.flatMap((entry) => {
      const { routeId, stationId, stationOrd } = entry.inbound
      // 노선이나 정류장을 모르면 판정 자체가 성립하지 않는다.
      if (routeId === undefined || stationId === null) return []
      return [{ spot: entry.spot, routeId, stationId, stationOrd }]
    })

    const known: SpotReach[] = targets
      .filter((target) => target.stationOrd !== undefined)
      .map(({ spot, routeId, stationOrd }) => ({ spot, routeId, stationOrd: stationOrd! }))

    const missing = targets.filter((target) => target.stationOrd === undefined)
    const routeIds = [...new Set(missing.map((target) => target.routeId))]

    const lists = await Promise.all(
      routeIds.map(async (routeId) => {
        try {
          return [routeId, await fetchBusApi<BusRouteStation>('4', routeId)] as const
        } catch {
          /**
           * 한 노선이 실패해도 나머지는 살린다. 이건 부가 정보이므로
           * 여기서 던지면 도착정보 전체가 502가 된다. 도착 시각이 더 중요하다.
           */
          console.warn(`[spot-reach] 노선 ${routeId}의 정류장 목록을 받지 못했다`)
          return [routeId, [] as BusRouteStation[]] as const
        }
      }),
    )

    const byRoute = new Map(lists)

    const resolved = missing.flatMap((target) => {
      const found = byRoute
        .get(target.routeId)
        ?.find((station) => station.stationId === target.stationId)

      if (!found) {
        // 정적 매핑과 상류 노선이 어긋난 상태다. 추측해서 채우지 않는다.
        console.warn(
          `[spot-reach] ${target.spot}: 노선 ${target.routeId}에서 정류장 ${target.stationId}를 찾지 못했다`,
        )
        return []
      }

      return [{ spot: target.spot, routeId: target.routeId, stationOrd: found.stationOrd }]
    })

    return [...known, ...resolved]
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'spot-reach',
    getKey: () => 'all',
  },
)

/**
 * 도착 목록에 닿는 관광지를 붙인다
 *
 * 순번을 확인하지 못한 관광지는 아예 담기지 않는다. 빈 배열이 "닿는 곳이 없다"와
 * "판정하지 못했다"를 구분하지 못하지만, 화면은 둘 다 아무것도 표시하지 않으므로
 * 구분할 이유가 없다. 틀린 것을 보여주지 않는 쪽이 기준이다.
 */
export async function withSpots(arrivals: BusArrival[]): Promise<ArrivalWithSpots[]> {
  const reaches = await resolveSpotReaches()

  return arrivals.map((arrival) => ({
    ...arrival,
    spots: reaches
      .filter((reach) => reach.routeId === arrival.routeId && arrival.stationOrd < reach.stationOrd)
      .map((reach) => ({ name: reach.spot, stopsAway: reach.stationOrd - arrival.stationOrd }))
      .sort((a, b) => a.stopsAway - b.stopsAway),
  }))
}
