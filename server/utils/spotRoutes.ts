import type { BusRoute, StationPin } from '#shared/types/bus'
import type { RouteStationIndex, SpotRouteInfo, SpotRouteOption } from '#shared/types/static-data'
import type { Spot } from '#shared/types/tour'
import { distanceMeters } from '#shared/constants/location'

// 방향 판정과 묶기는 순수 함수라 따로 둔다. 그래야 node로 회귀를 돌릴 수 있다.
import { anchors, groupByNum } from './routeDirection'

import routeStations from '../data/route-stations.json'

/**
 * 관광지 → 이 관광지에 오는 노선
 *
 * 승강장을 고르지 않는다. 그게 이 접근의 요점이다.
 *
 * 좌표로 가장 가까운 승강장 하나를 고르는 방식을 먼저 재봤고, 44곳 중 30곳에서
 * 같은 이름의 승강장이 120m 안에 둘씩 있었다. 차이가 0m인 곳도 있었다
 * (이천동석불상 83m / 83m). 거리로는 못 고른다. 잘못 고르면 도착 정보가 안 뜨거나
 * **반대 방향 버스를 안내한다.** → ADR-015 · ADR-016
 *
 * 그래서 근처 정류장을 **전부** 후보로 두고 노선을 모은다. 두 승강장이 같은 노선
 * 위에 있으므로 "210번이 온다"는 답은 어느 쪽을 집어도 같다. 방향은 승강장이 아니라
 * 노선이 가른다 — 안동 API는 방향별로 routeId가 따로다(ADR-007).
 *
 * 사람이 확인한 매핑(`spot-station-map.json`)을 대체하지 않는다. 그쪽은 실시간
 * 도착을 조회할 승강장을 확정한 7곳이고, 이쪽은 노선만 말하는 44곳이다.
 * 근거가 다르므로 화면에서도 같은 무게로 말하지 않는다.
 */
const index = routeStations as unknown as RouteStationIndex

/**
 * 관광지에서 이 거리 안의 정류장을 후보로 본다.
 *
 * 실측(2026-09-10): 700m면 36곳, 1300m면 40곳이 노선을 얻는다. 늘린 400m가
 * 관광지 4곳을 살린다. 더 늘리지 않는 이유는 1.3km가 도보 20분이고, 그보다 멀면
 * "이 정류장에서 내려요"가 안내가 아니라 떠넘기기가 되기 때문이다.
 */
const SPOT_RADIUS = 1300

/** 화면에 내보내는 노선 수. 시내 관광지는 80개까지 나온다. */
const MAX_OPTIONS = 5

/**
 * 정류장 → 그 정류장을 지나는 [노선, 순번]
 *
 * 색인을 뒤집어 둔다. 관광지마다 노선 422개를 전부 훑으면 요청당 2만 번을 도는데,
 * 뒤집어 두면 근처 정류장 수(대개 5~40)만큼만 본다. 람다 인스턴스당 한 번 만든다.
 */
let reverse: Map<number, [string, number][]> | null = null

function reverseIndex(): Map<number, [string, number][]> {
  if (reverse) return reverse

  reverse = new Map()
  for (const [routeId, route] of Object.entries(index.routes)) {
    for (const [position, [stationId]] of route.stations.entries()) {
      const list = reverse.get(stationId)
      if (list) list.push([routeId, position])
      else reverse.set(stationId, [[routeId, position]])
    }
  }
  return reverse
}

export async function resolveSpotRoutes(spot: Spot): Promise<SpotRouteInfo> {
  /**
   * 우리 라우트를 부른다. 둘 다 캐시되어 있어(정류장 1일, 노선 1분) 따뜻할 때
   * 추가 원격 호출이 0이다. 원격을 직접 부르면 그 캐시를 버린다.
   * → `spot-bus/[spot].get.ts`의 같은 판단
   */
  const [stations, routes] = await Promise.all([
    $fetch<StationPin[]>('/api/bus/stations'),
    $fetch<BusRoute[]>('/api/bus/routes'),
  ])

  const byRouteId = new Map(routes.map((route) => [route.routeId, route]))
  const lookup = reverseIndex()

  const near = stations
    .map((station) => ({
      station,
      walk: Math.round(distanceMeters(spot.lat, spot.lng, station.lat, station.lng)),
    }))
    .filter((candidate) => candidate.walk <= SPOT_RADIUS)

  const inbound: SpotRouteOption[] = []
  const outbound: SpotRouteOption[] = []
  /** 근처 정류장을 지나기는 하는데 시내와 닿지 않는 노선. 환승이 필요하다는 뜻이다. */
  let touched = 0

  /** 한 노선이 근처 정류장 여러 곳을 지날 수 있다. 가장 가까운 것 하나만 남긴다. */
  const best = new Map<string, { position: number; walk: number; station: StationPin }>()

  for (const { station, walk } of near) {
    for (const [routeId, position] of lookup.get(station.stationId) ?? []) {
      const current = best.get(routeId)
      if (!current || walk < current.walk) best.set(routeId, { position, walk, station })
    }
  }

  for (const [routeId, hit] of best) {
    const route = index.routes[routeId]
    const meta = byRouteId.get(Number(routeId))
    if (!route || !meta) continue

    touched++
    if (!route.town.length) continue

    const { inbound: inAnchor, outbound: outAnchor } = anchors(route.town, hit.position)
    const spotLen = route.stations[hit.position]?.[1] ?? 0

    const build = (anchor: number): SpotRouteOption => ({
      routeId: meta.routeId,
      routeNum: meta.routeNum,
      routeNm: meta.routeNm,
      runTotCnt: meta.runTotCnt,
      stops: Math.abs(hit.position - anchor),
      roadMeters: Math.abs(spotLen - (route.stations[anchor]?.[1] ?? 0)),
      stationId: hit.station.stationId,
      stationNm: hit.station.stationNm,
      ...(hit.station.nameEn ? { stationNmEn: hit.station.nameEn } : {}),
      walkMeters: hit.walk,
    })

    if (inAnchor !== null) inbound.push(build(inAnchor))
    if (outAnchor !== null) outbound.push(build(outAnchor))
  }

  const groupedIn = groupByNum(inbound)
  const groupedOut = groupByNum(outbound)

  return {
    spot: spot.name,
    inbound: groupedIn.slice(0, MAX_OPTIONS),
    outbound: groupedOut.slice(0, MAX_OPTIONS),
    inboundTotal: groupedIn.length,
    outboundTotal: groupedOut.length,
    // 노선은 지나는데 그 노선이 전부 시내와 안 닿는 상태. 빈 목록과 뜻이 다르다.
    disconnected: touched > 0 && groupedIn.length === 0 && groupedOut.length === 0,
    nearbyStations: near.length,
    // 이미 받아 둔 목록을 한 번 더 훑을 뿐이다. 추가 상류 호출이 없다.
    fleetRunning: routes.some((candidate) => candidate.runTotCnt > 0),
  }
}
