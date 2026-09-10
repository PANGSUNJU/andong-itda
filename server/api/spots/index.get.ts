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
/**
 * 목록은 캐시하고 **영문 이름은 요청 시점에 붙인다.**
 *
 * ⚠️ 예전에는 영문 붙이기가 이 캐시 안에 있었고, 그 조회가 실패하면 결과를
 *    조용히 삼킨 채 **하루 동안 캐시에 얼어붙었다.** 실측(2026-09-10): 배포본이
 *    영문명 0/44를 내보내고 있었고 로컬은 같은 코드로 17/44였다.
 *    `/en` 화면 전체가 국문 이름으로 나가고 있었다는 뜻이다. → ADR-040
 *
 *    축제가 이미 같은 처방을 쓴다 — 목록은 1일 캐시, 판정은 요청 시점(ADR-035).
 *    실패할 수 있는 것과 오래 사는 것을 같은 캐시에 담지 않는다.
 *
 * 요청마다 도는 것은 44 × 57번의 이름 비교뿐이다. 영문 풀 자체는 따로 캐시된다.
 */
const cachedSpots = defineCachedFunction(
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

    // 정렬을 보충 뒤에 둔다. 보충은 순위를 건드리지 않지만, 순서가 결과에
    // 의존하지 않는다는 걸 코드 모양으로 남겨 둔다.
    // hubRank 오름차순. 문자열로 오는 값이라 mergeSpot에서 숫자로 바꿔 둔다.
    return withPhotos.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'tour-spots',
    // 쿼리 파라미터를 붙여 호출해도 캐시 항목이 늘어나지 않게 키를 고정한다.
    getKey: () => 'all',
  },
)

export default defineEventHandler(
  async (): Promise<Spot[]> => attachEnglishNames(await cachedSpots()),
)
