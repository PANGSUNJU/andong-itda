import type { Spot } from '#shared/types/tour'

/**
 * 중심관광지 순위 목록 — LocgoHub 뼈대 + KorService2 병합
 *
 * 두 API의 결핍이 서로 반대다.
 *   LocgoHub    실제 방문 기반 순위와 대표 관광지를 전부 가진다. 설명·이미지가 없다.
 *   KorService2 설명·이미지·주소가 풍부하다. 지역 조회로는 핵심 관광지가 빠진다.
 * 그래서 LocgoHub를 뼈대로 삼고 KorService2를 얹는다. 반대로 하면 대표 관광지가 빠진다.
 *
 * 병합을 두 단계로 한다.
 *   1. 지역 조회(areaBasedList2)와 좌표 200m 매칭 — 넓게 한 번에 훑는다
 *   2. 그래도 이미지가 없는 것만 이름으로 재검색(searchKeyword2)
 *
 * 2단계가 필요한 이유는 상류 데이터 결함이다. 하회마을·도산서원·월영교 등은
 * areacode가 빈 값이라 지역 조회에 안 잡히는데, 이름으로 찾으면 이미지까지 다 있다.
 * 이게 없으면 **인기 1~11위가 전부 이미지 없이** 표시된다. → 08-02 실측
 *
 * 순위는 매월 바뀐다. 하드코딩하지 않는다.
 * 검증(2026-07-30, baseYm 202606): 1위 월영교, 2위 안동하회마을, 3위 병산서원.
 * PROJECT-PROMPT §3-2에 적힌 순위(1위 하회마을, 2위 월영교)와 이미 다르다.
 *
 * 1일 캐시한다. 원본이 월 단위로 갱신되는 데이터라 그보다 짧게 볼 이유가 없다.
 * 캐시가 빈 첫 요청은 TourAPI를 수십 번 호출하므로 캐시가 특히 중요하다.
 */
export default defineCachedEventHandler(
  async (): Promise<Spot[]> => {
    // 두 소스는 서로를 기다릴 이유가 없다.
    const [hub, korSpots] = await Promise.all([fetchHubSpots(), fetchKorSpots()])

    const merged = hub.items.map((hubSpot) => mergeSpot(hubSpot, matchKorSpot(hubSpot, korSpots)))

    // 정렬을 보충 뒤에 둔다. 보충은 순위를 건드리지 않지만, 순서가 결과에
    // 의존하지 않는다는 걸 코드 모양으로 남겨 둔다.
    return (
      (await backfillImages(merged))
        // hubRank 오름차순. 문자열로 오는 값이라 mergeSpot에서 숫자로 바꿔 둔다.
        .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    )
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'tour-spots',
    // 쿼리 파라미터를 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)
