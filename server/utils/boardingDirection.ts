import type { RouteStationIndex, SpotBoarding, SpotBoardingRoute } from '#shared/types/static-data'

// 별칭이 아니라 상대경로다. `scripts/*.ts`를 node로 직접 돌릴 때 별칭은 해석되지
// 않는다. → `tourApi.ts`·`walkAreas.ts`의 같은 주석
import { distanceMeters } from '../../shared/constants/location.ts'

/**
 * 목적지행 판정 — 순수 함수만 둔다
 *
 * `spotBoarding.ts`에서 떼어냈다. 여기가 뒤집히면 **여행자를 반대 방향 버스에
 * 태운다.** 노선 색인(400KB JSON)과 상류 호출이 섞여 있으면 회귀로 고정할 수
 * 없어 I/O 없는 함수만 남겼다. → `routeDirection.ts`의 같은 판단
 *
 * ⚠️ 런타임 임포트가 `distanceMeters` 하나뿐이다. 노선 색인도 정류장 목록도
 *    **인자로 받는다.** 그래야 `scripts/check-boarding.ts`가 가짜 노선을 넣어
 *    "목적지를 지난 정류장에서 타면 안 된다"를 직접 잴 수 있다.
 */

/** 계산에 필요한 정류장의 최소 모양. 회귀가 가짜 정류장을 넣을 수 있게 좁게 잡는다. */
export interface BoardingStation {
  stationId: number
  lat: number
  lng: number
}

/** 정류장 자체를 목적지로 삼을 때 필요한 모양. 이름으로 묶기 때문에 이름이 더 필요하다. */
export interface NamedStation extends BoardingStation {
  stationNm: string
}

/**
 * 정류장을 목적지로 — 안동역·터미널처럼 관광지가 아닌 곳
 *
 * 관광 API(`/api/spots`)에는 **교통 거점이 한 곳도 없다**(실측 2026-09-16: 44곳 중 0).
 * 그런데 차 없이 여행하는 사람의 마지막 이동은 대개 "터미널로 돌아가기"다.
 * 안동역(안동터미널)은 기차역이자 시외버스터미널이라 그 한 곳이 둘을 겸한다.
 *
 * ⚠️ **이름으로 묶는다.** "안동역(안동터미널)"은 승강장이 셋이고, 노선마다 서는
 *    승강장이 다르다. 목적지를 승강장 하나로 고정하면 다른 승강장에 서는 노선이
 *    통째로 빠진다. 사람은 "안동역에 간다"고 말하지 몇 번 승강장이라 말하지 않는다.
 *
 * 관광지와 달리 반경 검색이 없다. 목적지가 정류장 자신이라 하차 지점이 정확하고,
 * 그래서 `walkMeters`가 0이다 — 내려서 걸을 거리가 없다.
 */
export function computeStopBoarding(
  stopName: string,
  stations: NamedStation[],
  lookup: Map<number, [string, number][]>,
  routeIndex: RouteStationIndex,
): SpotBoarding {
  const targets = stations.filter((station) => station.stationNm === stopName)
  const targetIds = new Set(targets.map((station) => station.stationId))

  /**
   * 노선마다 **가장 이른 순번**을 쓴다.
   *
   * 순환 노선은 같은 정류장을 두 번 지나고, 승강장이 셋이면 한 노선이 그중 둘을
   * 지나기도 한다. 늦은 쪽을 쓰면 먼저 닿는 승강장에서 내릴 사람을 더 태우고 가게
   * 안내한다. 이른 쪽이 "언제 도착하나"에 대한 답이다.
   */
  const best = new Map<number, { destIndex: number; stationId: number }>()

  for (const station of targets) {
    for (const [routeId, position] of lookup.get(station.stationId) ?? []) {
      const id = Number(routeId)
      const current = best.get(id)
      if (!current || position < current.destIndex) {
        best.set(id, { destIndex: position, stationId: station.stationId })
      }
    }
  }

  const routes: SpotBoardingRoute[] = [...best].map(([routeId, hit]) => ({
    routeId,
    // 상류 눈금으로 바꿔 내보낸다. → `SpotBoardingRoute.destOrd`
    destOrd: hit.destIndex + 1,
    stationId: hit.stationId,
    // 목적지가 정류장 자신이다. 내려서 걸을 거리가 없다.
    walkMeters: 0,
  }))

  const boarding = new Set<number>()

  for (const [routeId, { destIndex }] of best) {
    const route = routeIndex.routes[String(routeId)]
    if (!route) continue

    for (let position = 0; position < destIndex; position++) {
      const stationId = route.stations[position]?.[0]
      // 같은 이름의 다른 승강장에서 타라고 하지 않는다. 거기 선 사람은 이미 도착했다.
      if (stationId === undefined || targetIds.has(stationId)) continue
      boarding.add(stationId)
    }
  }

  return { spot: stopName, routes, boardingStations: [...boarding] }
}

export function computeBoarding(
  spot: { name: string; lat: number; lng: number },
  stations: BoardingStation[],
  /** 정류장 → [노선, 순번]. `spotRoutes.reverseIndex()`가 만드는 모양 그대로다. */
  lookup: Map<number, [string, number][]>,
  routeIndex: RouteStationIndex,
  /** 목적지에서 이 거리 안의 정류장을 하차 후보로 본다(m). → `spotRoutes.SPOT_RADIUS` */
  radius: number,
): SpotBoarding {
  /**
   * 하차 정류장을 좌표로 하나만 고르지 않는다. 44곳 중 30곳에서 같은 이름의
   * 승강장이 120m 안에 둘씩 있고 차이가 0m인 곳도 있다(→ `spotRoutes.ts`).
   * 근처 정류장을 전부 후보로 두고, **노선마다** 목적지에 가장 가까운 것 하나를 남긴다.
   */
  /**
   * ⚠️ 안에서는 **배열 인덱스**(0부터)로 다루고, 내보낼 때만 상류 눈금(1부터)으로
   *    바꾼다. 두 눈금을 한 변수에 섞으면 off-by-one이 조용히 끼어든다 — 실제로
   *    끼었었다. → `SpotBoardingRoute.destOrd`
   */
  const best = new Map<number, { destIndex: number; walk: number; stationId: number }>()

  /**
   * 목적지 반경 안 정류장의 거리. 아래에서 "이미 목적지에 서 있는 정류장"을 가릴 때 쓴다.
   * 반경 밖은 담지 않는다 — 어차피 어떤 하차 정류장보다도 멀다.
   */
  const nearDistance = new Map<number, number>()

  for (const station of stations) {
    const walk = Math.round(distanceMeters(spot.lat, spot.lng, station.lat, station.lng))
    if (walk > radius) continue

    nearDistance.set(station.stationId, walk)

    for (const [routeId, position] of lookup.get(station.stationId) ?? []) {
      const id = Number(routeId)
      const current = best.get(id)
      if (!current || walk < current.walk) {
        best.set(id, { destIndex: position, walk, stationId: station.stationId })
      }
    }
  }

  const routes: SpotBoardingRoute[] = [...best].map(([routeId, hit]) => ({
    routeId,
    // 상류 눈금으로 바꿔 내보낸다. 인덱스는 0부터, stationOrd는 1부터다.
    destOrd: hit.destIndex + 1,
    stationId: hit.stationId,
    walkMeters: hit.walk,
  }))

  /**
   * 목적지보다 **앞선** 정류장만 담는다. 뒤엣것을 담으면 이미 지나친 정류장을
   * "여기서 타면 갑니다"라고 말하게 된다. 이 루프가 이 파일의 전부다.
   *
   * 순환 노선에서는 같은 정류장이 앞뒤로 두 번 나올 수 있다. 앞에 한 번이라도
   * 나오면 담기는데, 그게 맞다 — 거기서 타면 실제로 목적지에 닿는다.
   *
   * 하차 정류장 자신(`destOrd`)은 담지 않는다. 거기 선 사람은 이미 도착했다.
   *
   * ⚠️ 순번이 앞선다고 전부 승차 지점은 아니다. **하차 정류장보다 목적지에
   *    가깝거나 같은 정류장은 뺀다** — 거기서 타도 목적지에 더 가까워지지 않으므로
   *    승차 안내가 성립하지 않는다.
   *
   *    실측(2026-09-16): 44곳 중 **1곳에서 1건**만 걸린다(안동문화예술의전당 →
   *    안동초등학교). 드물지만 걸리면 명백히 이상한 안내가 되므로 남긴다.
   *
   * ⚠️ **이름이 같다고 같은 곳이 아니다.** "하회마을입구"는 하회마을에서 2,175m,
   *    "하회마을"이라는 이름의 다른 승강장은 1,521m 떨어져 있다. 이들은 반경 밖이고
   *    노선상 하차 정류장보다 앞이므로 **정당한 승차 정류장이다** — 거기서 타면
   *    160m 지점에 내린다. 이름으로 목적지 승강장을 걸러내려 하면 이런 곳을 잘못
   *    지운다. 거리로만 판정한다.
   */
  const boarding = new Set<number>()

  // 승차 후보는 **인덱스 공간**에서 고른다. 위 `best`가 그 눈금이다.
  for (const [routeId, { destIndex, walk: walkMeters }] of best) {
    const route = routeIndex.routes[String(routeId)]
    if (!route) continue

    for (let position = 0; position < destIndex; position++) {
      const stationId = route.stations[position]?.[0]
      if (stationId === undefined) continue

      const away = nearDistance.get(stationId)
      if (away !== undefined && away <= walkMeters) continue

      boarding.add(stationId)
    }
  }

  return { spot: spot.name, routes, boardingStations: [...boarding] }
}
