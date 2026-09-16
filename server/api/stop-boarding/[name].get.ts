import type { SpotBoarding } from '#shared/types/static-data'

/**
 * 정류장을 목적지로 삼았을 때의 판정 자료 — 안동역·터미널처럼 관광지가 아닌 곳
 *
 * `/api/spot-boarding/[id]`와 응답 모양이 같다. 화면이 둘을 구분하지 않아도 되게
 * 한 것이다 — 목적지가 관광지든 정류장이든 여행자가 묻는 것은 "그게 내가 가려는
 * 쪽인가" 하나다.
 *
 * **id가 아니라 이름으로 받는다.** "안동역(안동터미널)"은 승강장이 셋이고 노선마다
 * 서는 곳이 다르다. 승강장 하나로 고정하면 다른 승강장에 서는 노선이 통째로 빠진다.
 * 사람은 "안동역에 간다"고 말하지 몇 번 승강장이라 말하지 않는다.
 *
 * ⚠️ 1일 캐시다. 노선의 정류장 순서와 정류장 이름 말고는 보는 값이 없다. → ADR-040
 */
const cachedStopBoarding = defineCachedFunction(
  async (name: string): Promise<SpotBoarding> => {
    const result = await resolveStopBoarding(name)

    /**
     * 그 이름의 정류장이 아예 없으면 404다. 빈 결과로 답하면 화면이
     * "직행 노선이 없다"로 읽어 **없는 정류장을 있는 것처럼** 말하게 된다.
     */
    if (!result.routes.length && !result.boardingStations.length) {
      throw createError({
        statusCode: 404,
        statusMessage: `정류장 목록에 없는 이름: ${name}`,
      })
    }

    return result
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'stop-boarding',
    getKey: (name: string) => name,
  },
)

export default defineEventHandler(async (event): Promise<SpotBoarding> => {
  const name = getRouterParam(event, 'name', { decode: true }) ?? ''
  return await cachedStopBoarding(name)
})
