/**
 * 정류장 방면 데이터 생성 — `node scripts/build-station-directions.ts`
 *
 * 같은 이름의 정류장이 방향별로 여러 개 있다. 홈 화면 칩에 "안동역(안동터미널)"이
 * 세 개 나란히 뜨면 여행자는 어느 승강장에 서야 할지 고를 수가 없다.
 * 카카오·네이버가 "노하동입구 방면"처럼 붙이는 그 꼬리표를 여기서 만든다.
 *
 * 방면 = **노선상 다음 정류장의 이름**이다. 상류가 방면을 주지 않으므로
 * 노선별 정류장 목록(`tab=4`)에서 직접 센다.
 *
 * ⚠️ 노선이 421개다. 요청 시점에 계산할 수 없어(상류 421회) 정적 파일로 굽는다.
 *    노선의 정류장 순서는 시간표만큼도 자주 바뀌지 않는다. → ADR-016과 같은 판단
 *
 * 실측(2026-08-13): 노선 421개 / 정류장 2125곳 / 결과 JSON 41KB(gzip 15KB).
 */
import { writeFile } from 'node:fs/promises'

import type { BusRoute, BusRouteStation } from '../shared/types/bus.ts'
import type { RouteStationIndex } from '../shared/types/static-data.ts'
import { ANDONG_ORIGIN, distanceMeters } from '../shared/constants/location.ts'

const BUS_API = 'https://bus.andong.go.kr/m01/s04.do'
const OUT = new URL('../server/data/station-directions.json', import.meta.url)
const OUT_ROUTES = new URL('../server/data/route-stations.json', import.meta.url)

/**
 * 시내로 인정하는 반경(m). 안동역 기준이다.
 *
 * 이 값이 방향 판정의 전부다. 노선 안에서 이 반경 안의 정류장이 관광지보다 **앞**이면
 * 그 노선을 타고 시내에서 관광지로 갈 수 있다는 뜻이다. 3km는 안동 시내(터미널·
 * 교보생명·신시장·옥동)를 담고 풍산·와룡 같은 외곽 거점은 담지 않는 크기다.
 */
const DOWNTOWN_RADIUS = 3000

export interface StationDirections {
  /** stationId → 방면(다음 정류장 이름) */
  directions: Record<string, string>
  /**
   * 노선의 중간에 한 번도 놓이지 않는 정류장.
   *
   * 기점이거나 종점으로만 등장한다는 뜻이고, 그런 승강장에는 "접근 중인 차량"이
   * 성립하지 않아 도착정보(`tab=2`)가 **항상 빈 배열**이다. → ADR-015
   * 실측(2026-08-13): 354000536 "안동역(안동터미널)" = 종점 62 / 기점 6 / 중간 0 → 도착 0건.
   */
  terminusOnly: number[]
}

/**
 * 노선 색인 — 관광지 상세가 "어느 노선이 여기 오는가"에 답하는 근거
 *
 * 승강장을 고르지 않고 노선을 고른다. 관광지 근처 정류장이 이름이 같은 둘로
 * 갈려 있어도(2105곳 중 상당수가 그렇다) 둘 다 같은 노선 위에 있으므로
 * "210번이 온다"는 답은 바뀌지 않는다. 방향은 승강장이 아니라 **노선이** 가른다 —
 * 안동 API는 방향별로 routeId가 따로다(ADR-007).
 *
 *   들어오는 편 = 노선 안에 관광지보다 **앞선** 시내 정류장이 있다
 *   나가는 편   = 노선 안에 관광지보다 **뒤** 시내 정류장이 있다
 *
 * 순환 노선은 둘 다 참이 된다. 그게 맞다 — 시내에서 타고 갔다가 계속 타고
 * 돌아올 수 있는 노선이기 때문이다. 앞뒤를 하나로 정하면 그 사실을 잃는다.
 *
 * ⚠️ 시내 거점을 이름으로 박지 않는다. "교보생명"·"안동터미널"로 적으면 그 이름이
 *    바뀌는 날 조용히 전부 틀린다. 좌표로 판정한다.
 */
export function deriveRouteIndex(entries: [number, BusRouteStation[]][]): RouteStationIndex {
  const routes: RouteStationIndex['routes'] = {}

  for (const [routeId, list] of entries) {
    if (!list.length) continue

    const townIndexes = list
      .map((station, index) =>
        distanceMeters(ANDONG_ORIGIN.lat, ANDONG_ORIGIN.lng, station.gpsY, station.gpsX) <=
        DOWNTOWN_RADIUS
          ? index
          : -1,
      )
      .filter((index) => index >= 0)

    routes[String(routeId)] = {
      stations: list.map((station) => [station.stationId, station.routeLen]),
      /**
       * 시내에 드는 순번을 **전부** 담는다. 첫/마지막만 담았더니 "몇 정거장"이
       * 틀렸다. 210번은 index 7~20이 전부 시내인데, 첫 번째(7)를 기준으로 세면
       * 하회까지 44정거장이 되고 마지막(20)을 기준으로 세면 31정거장이 된다.
       * 실제로 타는 사람은 관광지에 가장 가까운 시내 정류장에서 탄다.
       */
      town: townIndexes,
    }
  }

  return { routes }
}

/**
 * 노선별 정류장 목록 → 정류장별 방면
 *
 * ⚠️ **같은 이름의 다음 정류장은 건너뛴다.** 안동터미널처럼 승강장이 여러 개인
 *    곳은 바로 다음 순번이 같은 이름이라, 그냥 다음을 집으면
 *    "안동역(안동터미널) 방면 안동역(안동터미널)"이 된다.
 *
 * 한 정류장이 노선마다 다른 다음 정류장을 가질 수 있다(지선 분기).
 * 가장 많이 나온 이름 하나만 남긴다. 여러 개를 붙이면 칩이 문장이 된다.
 *
 * 회귀 검증: `node scripts/check-bus-logic.ts`
 */
export function deriveDirections(lists: BusRouteStation[][]): StationDirections {
  const tally = new Map<number, Map<string, number>>()
  /** stationId → [노선 중간에 놓인 횟수, 전체 등장 횟수] */
  const position = new Map<number, [number, number]>()

  for (const list of lists) {
    for (const [index, station] of list.entries()) {
      const seen = position.get(station.stationId) ?? [0, 0]
      const isMiddle = index > 0 && index < list.length - 1
      position.set(station.stationId, [seen[0] + (isMiddle ? 1 : 0), seen[1] + 1])

      const next = list.slice(index + 1).find((later) => later.stationNm !== station.stationNm)
      if (!next) continue

      const names = tally.get(station.stationId) ?? new Map<string, number>()
      names.set(next.stationNm, (names.get(next.stationNm) ?? 0) + 1)
      tally.set(station.stationId, names)
    }
  }

  const directions: Record<string, string> = {}
  for (const [stationId, names] of tally) {
    const [top] = [...names].sort((a, b) => b[1] - a[1])
    if (top) directions[String(stationId)] = top[0]
  }

  const terminusOnly = [...position]
    .filter(([, [middle]]) => middle === 0)
    .map(([stationId]) => stationId)
    .sort((a, b) => a - b)

  return { directions, terminusOnly }
}

async function fetchBusApi<T>(tab: string, id?: number): Promise<T[]> {
  const query = id === undefined ? `tab=${tab}` : `i=${id}&tab=${tab}`
  const response = await fetch(`${BUS_API}?${query}`)
  if (!response.ok) throw new Error(`${query} → ${response.status}`)
  return response.json() as Promise<T[]>
}

async function main() {
  const routes = await fetchBusApi<BusRoute>('3')
  console.log(`노선 ${routes.length}개`)

  // 상류를 421번 부른다. 동시 12개로 묶어 상대 서버를 밀어내지 않는다.
  //
  // routeId를 함께 들고 있는다. 방면(deriveDirections)은 노선이 누구인지 몰라도
  // 되지만 노선 색인(deriveRouteIndex)은 알아야 한다. 두 파일을 각각 구우려고
  // 상류를 842번 부를 이유는 없다.
  const entries: [number, BusRouteStation[]][] = []
  let cursor = 0
  let failed = 0

  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (cursor < routes.length) {
        const route = routes[cursor++]!
        try {
          entries.push([route.routeId, await fetchBusApi<BusRouteStation>('4', route.routeId)])
        } catch {
          // 한 노선이 빠져도 나머지로 방면은 나온다. 다만 몇 개가 빠졌는지는 말한다.
          failed++
        }
      }
    }),
  )

  const lists = entries.map(([, list]) => list)

  if (failed > routes.length / 10) {
    throw new Error(`노선 ${failed}개를 받지 못했다. 데이터가 성기다 — 다시 실행할 것`)
  }

  const derived = deriveDirections(lists)

  await writeFile(
    OUT,
    `${JSON.stringify({
      _meta: {
        description: '정류장별 방면(노선상 다음 정류장) · 도착정보가 없는 기·종점 전용 승강장',
        generatedBy: 'node scripts/build-station-directions.ts',
        generatedAt: new Date().toISOString().slice(0, 10),
        source: `${BUS_API} tab=3 · tab=4`,
        routes: lists.length,
      },
      ...derived,
    })}\n`,
  )

  const index = deriveRouteIndex(entries)
  const connected = Object.values(index.routes).filter((r) => r.town.length > 0).length

  await writeFile(
    OUT_ROUTES,
    `${JSON.stringify({
      _meta: {
        description:
          '노선별 정류장 순서와 누적 거리 · 노선 안에서 시내(안동역 반경 3km)에 드는 첫/마지막 순번',
        generatedBy: 'node scripts/build-station-directions.ts',
        generatedAt: new Date().toISOString().slice(0, 10),
        source: `${BUS_API} tab=3 · tab=4`,
        downtownRadiusM: DOWNTOWN_RADIUS,
        routes: Object.keys(index.routes).length,
      },
      ...index,
    })}
`,
  )

  console.log(
    `방면 ${Object.keys(derived.directions).length}곳 · 기·종점 전용 ${derived.terminusOnly.length}곳 · 실패 ${failed}개`,
  )
  console.log(`노선 색인 ${Object.keys(index.routes).length}개 (시내와 닿는 노선 ${connected}개)`)
}

// import로 불렸을 때(회귀 검증)는 상류를 부르지 않는다.
if (process.argv[1]?.includes('build-station-directions')) await main()
