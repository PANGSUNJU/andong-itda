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

const BUS_API = 'https://bus.andong.go.kr/m01/s04.do'
const OUT = new URL('../server/data/station-directions.json', import.meta.url)

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
  const lists: BusRouteStation[][] = []
  let cursor = 0
  let failed = 0

  await Promise.all(
    Array.from({ length: 12 }, async () => {
      while (cursor < routes.length) {
        const route = routes[cursor++]!
        try {
          lists.push(await fetchBusApi<BusRouteStation>('4', route.routeId))
        } catch {
          // 한 노선이 빠져도 나머지로 방면은 나온다. 다만 몇 개가 빠졌는지는 말한다.
          failed++
        }
      }
    }),
  )

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

  console.log(
    `방면 ${Object.keys(derived.directions).length}곳 · 기·종점 전용 ${derived.terminusOnly.length}곳 · 실패 ${failed}개`,
  )
}

// import로 불렸을 때(회귀 검증)는 상류를 부르지 않는다.
if (process.argv[1]?.includes('build-station-directions')) await main()
