import { FOOD_CATEGORY_ORDER } from '#shared/constants/region'
import type { FoodPlace } from '#shared/types/tour'

/**
 * 안동 음식점 목록 — KorService2 단독
 *
 * /api/spots와 모양이 다르다. 저쪽은 두 API를 병합하고 이미지를 네 단계로
 * 보충하지만, 이쪽은 호출 한 번이면 끝난다.
 * 병합할 상대(LocgoHub 음식점)가 없고, 보충이 통하지 않기 때문이다(0/7). → ADR-023
 *
 * 정렬 축이 분류인 이유도 같은 데서 온다. 음식점에는 순위가 없다.
 * 그래서 "인기순"을 만들 수 없고, 대신 향토음식을 앞에 세운다.
 *
 * 법정동 코드로 조회한다. 마지막까지 옛 지역 코드에 남아 있던 곳이었고
 * 2026-09-10에 옮겼다 — 15건 → **28건**, 빠지는 곳 0. 찜닭이 1곳에서 6곳이 됐다.
 * 안동의 대표 음식인데 목록에 한 곳뿐이었던 것이 조회 방식 때문이었다. → ADR-039
 *
 * 캐시는 /api/spots와 같은 1일이다. 상류가 월 단위로 움직이는 데이터라
 * 더 짧게 볼 이유가 없다. 28건이라 캐시가 비어도 첫 요청이 2~3초면 끝난다.
 */
export default defineCachedEventHandler(
  async (): Promise<FoodPlace[]> => {
    /**
     * 영문 이름은 28곳 중 5곳에만 붙는다. 그래도 붙는 곳은 붙인다.
     *
     * 이름 재검색 단계는 이제 존재하지 않는다(ADR-034). 있었을 때도 음식점에서는
     * 그때의 15곳 전부를 재검색해 한 건도 더 못 찾았다 — 이미지 보충이 0/7이었던 것과
     * 같은 이유다. 음식점은 지역 조회에 정상적으로 잡히고, 그 레코드에 영문이
     * 없는 것이다. → ADR-023 · ADR-033
     */
    const places = await attachEnglishNames(await fetchFoodPlaces())

    return places.sort(
      (a, b) =>
        FOOD_CATEGORY_ORDER.indexOf(a.category) - FOOD_CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name, 'ko'),
    )
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'tour-food',
    getKey: () => 'all',
  },
)
