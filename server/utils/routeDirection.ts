import type { SpotRouteOption } from '#shared/types/static-data'

/**
 * 노선 방향 판정과 노선 묶기 — 순수 함수만 둔다
 *
 * `spotRoutes.ts`에서 떼어냈다. 여기가 이 기능에서 화면 문구가 갈리는 지점이고,
 * 뒤집히면 여행자를 **반대 방향 버스에 태운다.** 상류 호출이 섞여 있으면
 * 회귀로 고정할 수 없어 I/O 없는 함수만 남겼다. → `scripts/check-bus-logic.ts`
 *
 * ⚠️ 런타임 임포트가 없다(타입만 들여온다). node로 직접 돌릴 수 있어야 하기 때문이다.
 */

/**
 * 노선 하나에서 관광지가 시내와 어떤 관계인지
 *
 * 시내 순번이 관광지보다 앞이면 들어오는 편, 뒤면 나가는 편이다. 둘 다면 둘 다다 —
 * 순환 노선은 같은 버스로 갔다가 계속 타고 돌아올 수 있으므로 그게 맞다.
 * 하나로 정하면 그 사실을 잃는다.
 *
 * 앞선 것 중 **가장 늦은** 것이 타는 자리다. 실제로 타는 사람은 관광지에 가장 가까운
 * 시내 정류장에서 탄다. 가장 이른 것을 쓰면 210번 하회가 31정거장이 아니라
 * 44정거장이 되고, 그 숫자를 보고 "너무 머네" 하고 화면을 닫는다.
 */
export function anchors(
  town: number[],
  position: number,
): { inbound: number | null; outbound: number | null } {
  let inbound: number | null = null
  let outbound: number | null = null

  for (const index of town) {
    if (index < position) inbound = inbound === null ? index : Math.max(inbound, index)
    else if (index > position) outbound = outbound === null ? index : Math.min(outbound, index)
  }

  return { inbound, outbound }
}

/**
 * 걸어갈 거리가 크게 벌어지면 먼 쪽은 대안이 아니다.
 *
 * 하회마을에 211번이 "광덕리 하차, 도보 1,185m"로 딸려 왔다. 160m짜리 정류장이
 * 있는데 1.2km를 걸으라는 선택지는 대안이 아니라 소음이고, 목록에 있다는 것만으로
 * 탈 만하다는 뜻이 된다. 가까운 것이 하나라도 있으면 먼 것은 지운다.
 *
 * 전부 먼 곳(외곽 관광지)은 그대로 남긴다. 그게 유일한 답이기 때문이다.
 */
export const WALKABLE_DROP = 700

/**
 * 같은 노선 번호를 하나로 묶는다
 *
 * 210번은 방향·경유지별로 routeId가 넷이다. 화면에 "210, 210, 210, 210"을 늘어놓으면
 * 그건 정보가 아니라 소음이다.
 *
 * ⚠️ 대표는 **덜 걷는 쪽**이다. 정거장 수를 먼저 봤더니 하회마을에서 210번이
 *    "탈놀이전수관앞 하차, 도보 506m"로 나왔다 — 160m 떨어진 하회마을 정류장을
 *    두고 한 정거장을 아끼려고 346m를 더 걷게 하는 답이다. 도산서원은 293m 대신
 *    1,059m, 만휴정은 219m 대신 814m가 나왔다. 버스에서 한 정거장은 몇 분이지만
 *    그 차이는 걷는 사람의 다리에 그대로 붙는다.
 *
 * 운행 차량 수는 갈래 전체에서 가장 큰 값을 쓴다. 한 갈래라도 돌고 있으면
 * 그 번호의 버스는 오늘 다닌다.
 *
 * 회귀 검증: `node scripts/check-bus-logic.ts`
 */
export function groupByNum(options: SpotRouteOption[]): SpotRouteOption[] {
  const groups = new Map<string, SpotRouteOption>()

  for (const option of options) {
    const current = groups.get(option.routeNum)
    if (!current) {
      groups.set(option.routeNum, { ...option })
      continue
    }
    const runTotCnt = Math.max(current.runTotCnt, option.runTotCnt)
    const better =
      option.walkMeters < current.walkMeters ||
      (option.walkMeters === current.walkMeters && option.stops < current.stops)
    groups.set(option.routeNum, better ? { ...option, runTotCnt } : { ...current, runTotCnt })
  }

  const all = [...groups.values()]
  if (!all.length) return all

  const closest = Math.min(...all.map((option) => option.walkMeters))
  const kept =
    closest <= WALKABLE_DROP ? all.filter((option) => option.walkMeters <= WALKABLE_DROP) : all

  return kept.sort(
    (a, b) => a.walkMeters - b.walkMeters || b.runTotCnt - a.runTotCnt || a.stops - b.stops,
  )
}
