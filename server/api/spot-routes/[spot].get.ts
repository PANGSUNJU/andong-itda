import type { SpotRouteInfo } from '#shared/types/static-data'
import type { Spot } from '#shared/types/tour'

/**
 * 관광지 노선 안내 — 44곳 전부에 답한다
 *
 * `/api/spot-bus/[spot]`은 사람이 확인한 7곳에만 답한다(나머지는 404). 그건 실시간
 * 도착을 조회할 **승강장**을 확정한 곳만 답할 수 있기 때문이고, 그 판단은 옳다.
 * 이 엔드포인트는 다른 질문에 답한다 — "어느 버스를 타면 여기 오는가."
 * 그건 승강장을 확정하지 않아도 노선 데이터만으로 답할 수 있다. → `spotRoutes.ts`
 *
 * 두 엔드포인트를 합치지 않는다. 근거가 다르고, 하나가 실패해도 다른 하나는
 * 화면에 남아야 한다.
 *
 * ⚠️ **이름만 받는다.** 편의상 `?lat=&lng=`를 열면 이 라우트는 누구의 좌표든 받는
 *    라우트가 되고, 그 값이 배포 로그에 남기 시작한다. 지금은 "서버에 좌표를 읽는
 *    코드가 없다"가 감사 한 줄로 증명되는데 그 성질을 잃는다. 관광지 좌표는
 *    공개 데이터이므로 서버가 목록에서 직접 찾는다. → ADR-024
 *
 * ⚠️ **1분 캐시다.** 처음에 1시간으로 뒀는데 이 응답에서 시시각각 바뀌는 값이
 *    `runTotCnt`(운행 중 차량 수)라 배지가 최대 1시간 묵는다. 월영교 첫차가
 *    08:25에 나가도 화면은 "운행 중인 차량이 없어요"를 계속 들고 있었다.
 *    `/api/bus/routes`가 1분 캐시이므로 그 수명에 맞춘다.
 *
 *    재계산은 싸다 — 역색인은 모듈 스코프에 한 번 만들고(`spotRoutes.ts`),
 *    내부 `$fetch` 둘은 각자의 캐시(정류장 1일 · 노선 1분)를 그대로 탄다.
 */
const cachedRoutes = defineCachedFunction(
  async (name: string): Promise<SpotRouteInfo> => {
    const spots = await $fetch<Spot[]>('/api/spots')
    const spot = spots.find((candidate) => candidate.name === name)

    if (!spot) {
      throw createError({
        statusCode: 404,
        statusMessage: `관광지 목록에 없는 이름: ${name}`,
      })
    }

    return await resolveSpotRoutes(spot)
  },
  {
    maxAge: 60, // 1분 — runTotCnt의 수명에 맞춘다
    name: 'spot-routes',
    getKey: (name: string) => name,
  },
)

export default defineEventHandler(async (event): Promise<SpotRouteInfo> => {
  const name = getRouterParam(event, 'spot', { decode: true }) ?? ''
  return await cachedRoutes(name)
})
