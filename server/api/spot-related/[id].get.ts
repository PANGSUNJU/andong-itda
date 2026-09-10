import type { RelatedSpot } from '#shared/types/tour'

/**
 * 함께 많이 찾는 곳 — `/api/spot-related/[id]`
 *
 * 상류 한 번이면 안동 전체가 온다(실측 951건). 그래서 관광지별로 부르지 않고
 * 통째로 받아 캐시한 뒤 여기서 잘라 준다. 44곳을 다 열어도 상류 호출은 하루 한 번이다.
 *
 * ⚠️ 없으면 404가 아니라 **빈 배열**이다. 44곳 중 21곳에만 데이터가 있는데, 그건
 *    오류가 아니라 상류가 그만큼만 주는 것이다. 화면은 빈 배열이면 섹션을 안 그린다.
 *    `/api/spot-bus`가 404를 주는 것과 다르다 — 저쪽은 "아직 확인 못 했다"는 뜻이라
 *    화면이 그 사실을 말해야 하고, 이쪽은 말할 것이 없다.
 *
 * ⚠️ 관광지 **id**를 받는다. 상류의 `tAtsCd`가 우리 `Spot.id`와 같은 값이라
 *    이름 매칭이 필요 없다. → `fetchRelatedSpots`
 */
const cachedRelated = defineCachedFunction(
  async (): Promise<Record<string, RelatedSpot[]>> => fetchRelatedSpots(),
  {
    maxAge: 60 * 60 * 24, // 1일 — 상류가 월 단위로 갱신되는 데이터다
    name: 'spot-related',
    getKey: () => 'all',
  },
)

export default defineEventHandler(async (event): Promise<RelatedSpot[]> => {
  const id = getRouterParam(event, 'id') ?? ''
  return (await cachedRelated())[id] ?? []
})
