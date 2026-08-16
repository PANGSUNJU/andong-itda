import { FOOD_CATEGORY_ORDER } from '#shared/constants/region'
import type { FoodPlace } from '#shared/types/tour'

/**
 * 안동 음식점 목록 — KorService2 단독
 *
 * /api/spots와 모양이 다르다. 저쪽은 두 API를 병합하고 결측 이미지를 키워드로
 * 보충하느라 첫 요청이 11초 걸리지만, 이쪽은 호출 한 번이면 끝난다.
 * 병합할 상대(LocgoHub 음식점)가 없고, 보충이 통하지 않기 때문이다(0/7). → ADR-023
 *
 * 정렬 축이 분류인 이유도 같은 데서 온다. 음식점에는 순위가 없다.
 * 그래서 "인기순"을 만들 수 없고, 대신 향토음식을 앞에 세운다.
 *
 * 캐시는 /api/spots와 같은 1일이다. 상류가 월 단위로 움직이는 데이터라
 * 더 짧게 볼 이유가 없다. 16건이라 캐시가 비어도 첫 요청이 2~3초면 끝난다.
 */
export default defineCachedEventHandler(
  async (): Promise<FoodPlace[]> => {
    // 영문 이름은 15곳 중 2곳에만 붙는다. 그래도 붙는 곳은 붙인다.
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
