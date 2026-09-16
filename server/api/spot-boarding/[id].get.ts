import type { SpotBoarding } from '#shared/types/static-data'
import type { Spot } from '#shared/types/tour'

/**
 * 목적지행 판정 자료 — 44곳 전부에 답한다
 *
 * 홈이 "목적지를 정한 사람"에게 답하기 위해 쓴다. 이름이 아니라 **id**로 받는다.
 * 홈은 `?to=<id>`로 목적지를 들고 있고, 그 값은 주소에 실려 새로고침과 공유를
 * 견뎌야 하므로 이름보다 id가 맞다(`/api/spot-guide/[id]`와 같은 모양).
 *
 * ⚠️ **1일 캐시다.** `/api/spot-routes`가 1분인 것과 대비되는데, 그쪽에는
 *    운행 중 차량 수(`runTotCnt`)가 실려 있어서다. 이 응답에는 시시각각 바뀌는
 *    값이 하나도 없다 — 노선의 정류장 순서와 좌표뿐이다. **값의 수명이 캐시
 *    수명을 정한다.** → ADR-040
 *
 * ⚠️ 관광지 좌표는 서버가 목록에서 직접 찾는다. 편의상 `?lat=&lng=`를 열면
 *    "서버에 좌표를 읽는 코드가 없다"가 감사 한 줄로 증명되던 성질을 잃는다.
 *    → ADR-024
 */
const cachedBoarding = defineCachedFunction(
  async (id: string): Promise<SpotBoarding> => {
    const spots = await $fetch<Spot[]>('/api/spots')
    const spot = spots.find((candidate) => candidate.id === id)

    if (!spot) {
      throw createError({
        statusCode: 404,
        statusMessage: `관광지 목록에 없는 id: ${id}`,
      })
    }

    return await resolveSpotBoarding(spot)
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'spot-boarding',
    getKey: (id: string) => id,
  },
)

export default defineEventHandler(async (event): Promise<SpotBoarding> => {
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  return await cachedBoarding(id)
})
