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
 * 1시간 캐시한다. 노선 구성은 실시간이 아니지만 `runTotCnt`(운행 중 차량 수)가
 * 섞여 있어 하루는 길다. 실시간이 필요한 화면은 `/api/spot-bus`가 맡는다.
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
    maxAge: 60 * 60, // 1시간
    name: 'spot-routes',
    getKey: (name: string) => name,
  },
)

export default defineEventHandler(async (event): Promise<SpotRouteInfo> => {
  const name = getRouterParam(event, 'spot', { decode: true }) ?? ''
  return await cachedRoutes(name)
})
