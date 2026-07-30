import type { Spot } from '#shared/types/tour'

/**
 * 중심관광지 순위 목록 — LocgoHub 뼈대 + KorService2 병합
 *
 * 두 API의 결핍이 서로 반대다.
 *   LocgoHub    실제 방문 기반 순위와 대표 관광지를 전부 가진다. 설명·이미지가 없다.
 *   KorService2 설명·이미지·주소가 풍부하다. 하회마을·도산서원·월영교가 아예 없다.
 * 그래서 LocgoHub를 뼈대로 삼고 KorService2를 얹는다. 반대로 하면 대표 관광지가 빠진다.
 *
 * 순위는 매월 바뀐다. 하드코딩하지 않는다.
 * 검증(2026-07-30, baseYm 202606): 1위 월영교, 2위 안동하회마을, 3위 병산서원.
 * PROJECT-PROMPT §3-2에 적힌 순위(1위 하회마을, 2위 월영교)와 이미 다르다.
 *
 * 1일 캐시한다. 원본이 월 단위로 갱신되는 데이터라 그보다 짧게 볼 이유가 없고,
 * 한 번 만드는 데 TourAPI를 3번(LocgoHub 1 + KorService2 2) 호출한다.
 */
export default defineCachedEventHandler(
  async (): Promise<Spot[]> => {
    // 두 소스는 서로를 기다릴 이유가 없다.
    const [hub, korSpots] = await Promise.all([fetchHubSpots(), fetchKorSpots()])

    return (
      hub.items
        .map((hubSpot) => mergeSpot(hubSpot, matchKorSpot(hubSpot, korSpots)))
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
