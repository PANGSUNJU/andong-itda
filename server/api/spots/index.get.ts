import type { Spot } from '#shared/types/tour'

/**
 * 중심관광지 순위 목록 — LocgoHub 뼈대 + KorService2 병합
 *
 * 두 API의 결핍이 서로 반대다.
 *   LocgoHub    실제 방문 기반 순위와 대표 관광지를 전부 가진다. 설명·이미지가 없다.
 *   KorService2 설명·이미지·주소가 풍부하다. 지역 조회로는 핵심 관광지가 빠진다.
 * 그래서 LocgoHub를 뼈대로 삼고 KorService2를 얹는다. 반대로 하면 대표 관광지가 빠진다.
 *
 * 조회는 법정동 코드로 한다. 옛 지역 코드(areaCode=35)로는 하회마을·도산서원·월영교가
 * KorService2 응답에 아예 없어서, 그것들을 이름으로 하나씩 재검색하느라 캐시가 빈
 * 첫 요청이 **11초**였다. 서버리스 기본 제한이 10초라 그 요청이 타임아웃되면 캐시가
 * 영영 안 채워지는 구조였다. 지금은 처음부터 풀 안에 들어온다. → ADR-034
 *
 * 순위는 매월 바뀐다. 하드코딩하지 않는다.
 * 검증(2026-08-23, baseYm 202607): 1위 월영교, 2위 안동하회마을, 3위 병산서원.
 * PROJECT-PROMPT §3-2에 적힌 순위(1위 하회마을, 2위 월영교)와 이미 다르다.
 *
 * 1일 캐시한다. 원본이 월 단위로 갱신되는 데이터라 그보다 짧게 볼 이유가 없다.
 */
export default defineCachedEventHandler(
  async (): Promise<Spot[]> => {
    // 두 소스는 서로를 기다릴 이유가 없다.
    const [hub, korSpots] = await Promise.all([fetchHubSpots(), fetchKorSpots()])

    const merged = hub.items.map((hubSpot) => mergeSpot(hubSpot, matchKorSpot(hubSpot, korSpots)))

    /**
     * 사진을 네 단계로 채운다. 전부 공공데이터 API 안에서 끝낸다.
     *   1. 지역 조회 병합    KorService2 areaBasedList2 — 좌표 200m         30곳
     *   2. 풀 안 재탐색      네트워크 없음 — 이름 1순위, 거리 2순위          +6곳
     *   3. 이름 재검색       KorService2 searchKeyword2 — 풀에 없는 타입     +4곳
     *   4. 관광사진 갤러리   PhotoGalleryService1      — 앞의 셋이 못 준 것  +1곳
     *
     * 뒤로 갈수록 증거가 약해진다(4단계는 좌표가 아예 없다). 순서를 바꾸지 않는다.
     * 2단계가 3단계 앞에 있는 것도 같은 이유가 아니라 비용 때문이다 — 같은 판정
     * 규칙을 쓰는데 한쪽은 호출이 0이다. 풀을 먼저 다 쓰고 나서 밖으로 나간다.
     *
     * `korSpots`를 그대로 넘긴다. 2단계가 보는 후보 풀이 1단계와 같은 응답이어야
     * "1단계가 좌표 게이트 때문에 놓친 것"이라는 말이 성립한다.
     */
    const withPhotos = await backfillFromGallery(await backfillImages(merged, korSpots))

    /**
     * 영문 이름도 같은 처방을 받았다. 지역 조회 → 광역 검색 → 이름 재검색 44회이던
     * 것이 법정동 조회 **한 번**이 됐고, 붙는 곳은 같은 17곳이다. → ADR-034
     *
     * 있는 곳에만 붙는다(54곳 중 17곳). 없다고 목록이 달라지지 않는다.
     */
    const withEnglish = await attachEnglishNames(withPhotos)

    // 정렬을 보충 뒤에 둔다. 보충은 순위를 건드리지 않지만, 순서가 결과에
    // 의존하지 않는다는 걸 코드 모양으로 남겨 둔다.
    // hubRank 오름차순. 문자열로 오는 값이라 mergeSpot에서 숫자로 바꿔 둔다.
    return withEnglish.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'tour-spots',
    // 쿼리 파라미터를 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)
