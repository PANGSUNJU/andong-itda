import type { Spot, SpotGuide } from '#shared/types/tour'

/**
 * 이용 안내 — "몇 시에 문 여나, 언제 쉬나, 주차는 되나"
 *
 * 관광지 상세가 오래도록 답하지 못하던 질문이다. 목록 조회(`areaBasedList2`)에는
 * 이 값들이 없어서, **관광지 한 곳씩 따로** 물어야 온다. 그래서 목록과 합치지
 * 않고 여기로 뗐다 — 44곳을 미리 다 물으면 목록 한 번에 상류 호출이 88회가 된다.
 *
 * 실측(2026-09-11, 44곳 전부 호출):
 *
 * ```
 * 운영시간  33/35   휴무일  34/35   주차  29/35   문의  34/35
 * (35 = 44곳 중 KorService2와 매칭된 곳. 나머지 9곳은 물어볼 contentId가 없다)
 * ```
 *
 * ⚠️ **1일 캐시다.** 운영시간은 계절 단위로도 잘 안 바뀐다. 같은 화면의
 *    `/api/spot-routes`가 1분인 것과 대비되는데, 그쪽은 운행 중 차량 수가 실려
 *    있어서다. 값의 수명이 캐시 수명을 정한다. → ADR-040
 *
 * ⚠️ **404를 내지 않는다.** 없는 관광지든 안내가 없는 관광지든 빈 객체다.
 *    화면은 "값이 있으면 줄을 그린다"로 짜여 있어서 그 둘을 구분할 필요가 없고,
 *    상세 화면이 이 한 칸 때문에 오류로 넘어가면 안 된다. → ADR-016
 */
const cachedGuide = defineCachedFunction(
  async (id: string): Promise<SpotGuide> => {
    const spots = await $fetch<Spot[]>('/api/spots')
    const spot = spots.find((candidate) => candidate.id === id)

    return spot ? await fetchSpotGuide(spot) : {}
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'spot-guide',
    getKey: (id: string) => id,
  },
)

export default defineEventHandler(async (event): Promise<SpotGuide> => {
  const id = getRouterParam(event, 'id', { decode: true }) ?? ''
  return await cachedGuide(id)
})
