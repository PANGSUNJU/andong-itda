import type { BusApiTab, BusArrival, ServiceStatus } from '#shared/types/bus'

/**
 * 안동시 버스정보 API 호출
 *
 * 인증키가 없다. 파라미터는 tab(오퍼레이션)과 i(대상 ID) 둘뿐이다.
 * 어떤 tab이든 래퍼 객체 없이 배열을 그대로 반환한다.
 *
 * ⚠️ 문서와 다른 점 (2026-07-30 실호출 확인)
 *    http로 문서화된 베이스가 실제로는 https로 302 리다이렉트한다.
 *    프록시는 서버에서 돌아 Mixed Content와 무관하므로 https를 직접 호출한다.
 *    도착정보는 캐시하지 않는 핫 패스라 리다이렉트 한 홉이 그대로 응답 지연이 된다.
 */
const BUS_API = 'https://bus.andong.go.kr/m01/s04.do'

export async function fetchBusApi<T>(tab: BusApiTab, id?: number | string): Promise<T[]> {
  try {
    return await $fetch<T[]>(BUS_API, {
      query: id === undefined ? { tab } : { i: id, tab },
      // 상류가 멈춰도 우리 라우트가 같이 멈춰 있지 않게 한다.
      timeout: 10_000,
    })
  } catch (error) {
    /**
     * 502 — 실패 원인이 우리가 아니라 상류에 있음을 상태 코드로 구분한다.
     * 원인을 그대로 담아 넘긴다. 안동시 API는 점검 시 HTML 페이지를 주거나
     * 조용히 타임아웃되므로, 원문 없이는 화면에서 원인을 알 수 없다.
     */
    throw createError({
      statusCode: 502,
      statusMessage: '안동시 버스정보 API 호출 실패',
      data: {
        upstream: `${BUS_API}?tab=${tab}${id === undefined ? '' : `&i=${id}`}`,
        reason: error instanceof Error ? error.message : String(error),
      },
      cause: error,
    })
  }
}

/**
 * 도착 임박 순 정렬 비교자 — predictTm 오름차순
 *
 * predictTm은 null로 올 수 있다(차량 위치 미확보). null을 0으로 취급하면
 * 위치를 모르는 차가 "가장 먼저 도착"으로 맨 앞에 올라와 화면이 거짓말을 한다.
 * 그래서 null은 값이 무엇이든 항상 뒤로 보낸다.
 *
 * 회귀 검증: `node scripts/check-bus-logic.ts`
 */
export function byPredictTm(
  a: Pick<BusArrival, 'predictTm'>,
  b: Pick<BusArrival, 'predictTm'>,
): number {
  // == null 로 null과 undefined를 한 번에 걸러낸다.
  if (a.predictTm == null) return b.predictTm == null ? 0 : 1
  if (b.predictTm == null) return -1
  return a.predictTm - b.predictTm
}

/**
 * 운행 상태 판정 — 도착정보 · 이 노선의 차량 수 · 안동 전체의 차량 수
 *
 * 도착정보가 빈 배열인 이유는 여럿이고, 여행자에게 주는 의미가 서로 반대다.
 *   이 노선 runTotCnt > 0  → 차는 돌고 있는데 아직 접근 중인 차가 없다 (기다리면 온다)
 *   이 노선 0, 전체 > 0     → 이 노선만 지금 안 다닌다 (첫차 전이거나 배차가 아주 길다)
 *   이 노선 0, 전체도 0     → 지금은 시내버스가 다니지 않는 시간이다 (기다려도 안 온다)
 *
 * ⚠️ 세 번째 인자가 없던 시절 이 함수는 뒤의 둘을 `closed`로 뭉쳤고, 화면은 그것을
 *    "오늘 운행이 끝났어요"라고 옮겼다. 새벽에 그건 사실과 **정반대**다.
 *    실측(2026-09-10 06:36): 전체 58개 노선 63대 운행 중, 월영교 112번만 0대
 *    (첫차 08:25). 안동시 API가 첫차·막차를 주지 않으므로(stTm·edTm 전부 null,
 *    ADR-016) 시계로 "첫차 전"을 추정하지 않는다. 대신 **전체가 도는지**를 본다 —
 *    그건 상류가 실제로 주는 값이다. → ADR-036
 *
 * `fleetRunning`은 `/api/bus/routes`(1분 캐시)의 전 노선 runTotCnt 합이 0보다
 * 큰지다. 호출부가 그 목록을 이미 받아 두므로 추가 상류 호출이 없다.
 *
 * 회귀 검증: `node scripts/check-bus-logic.ts`
 */
export function decideStatus(
  arrivalCount: number,
  runTotCnt: number,
  fleetRunning: boolean,
): ServiceStatus {
  if (arrivalCount > 0) return 'arriving'
  if (runTotCnt > 0) return 'waiting'
  return fleetRunning ? 'routeIdle' : 'offHours'
}
