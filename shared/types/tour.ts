/**
 * 한국관광공사 TourAPI 타입
 *
 * 두 개의 서로 다른 API를 함께 쓴다. 각각의 결핍을 서로가 채운다.
 *
 *   LocgoHubTarService1  실제 방문 기반 순위 · 좌표 · 대표 관광지 전부 포함
 *                        설명 · 이미지 · 운영시간 없음
 *   KorService2          설명 · 이미지 · 주소 · 운영시간 풍부
 *                        하회마을 · 도산서원 · 월영교가 데이터셋에 없음
 *
 * → ADR-004
 */

/**
 * 기초지자체 중심관광지 정보 (LocgoHubTarService1)
 *
 * 관광지 데이터의 뼈대다.
 * http://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1
 * 필수 파라미터: baseYm(YYYYMM), areaCd=47, signguCd=47170
 * 매월 8일 갱신되므로 최신 월이 없으면 이전 월로 폴백해야 한다.
 */
export interface HubSpot {
  /** 해시값. KorService2의 contentid와 매칭되지 않는다. */
  hubTatsCd: string
  hubTatsNm: string
  /** '관광지' | '숙박' — 숙박은 필터링한다(100건 중 약 35건). → ADR-009 */
  hubCtgryLclsNm: string
  /** '역사관광' | '기타관광' | '쇼핑' 등 */
  hubCtgryMclsNm: string
  hubCtgrySclsNm: string | null
  /** 중심지 순위. 문자열로 온다. */
  hubRank: string
  /** 경도. 문자열로 온다. */
  mapX: string
  /** 위도. 문자열로 온다. */
  mapY: string
  areaCd: string
  areaNm: string
  signguCd: string
  signguNm: string
  baseYm: string
}

/** 국문 관광정보 서비스 (KorService2) 지역기반 목록 */
export interface KorSpot {
  contentid: string
  contenttypeid: string
  title: string
  addr1: string
  addr2: string | null
  /** 경도. 문자열로 온다. */
  mapx: string
  /** 위도. 문자열로 온다. */
  mapy: string
  mlevel: string
  /**
   * 대표 이미지. 빈 문자열로 오는 항목이 있다.
   * 관광지 64건 중 4건, 음식점 16건 중 7건(44%)
   * 폴백 UI가 필수다.
   */
  firstimage: string
  firstimage2: string
  areacode: string
  sigungucode: string
  cat1: string
  cat2: string
  cat3: string
  lclsSystm1: string | null
  lclsSystm2: string | null
  lclsSystm3: string | null
  tel: string | null
  createdtime: string
  modifiedtime: string
}

/** TourAPI 공통 응답 래퍼 */
export interface TourApiResponse<T> {
  response: {
    header: { resultCode: string; resultMsg: string }
    body: {
      items: { item: T[] } | ''
      numOfRows: number
      pageNo: number
      totalCount: number
    }
  }
}

/**
 * 두 API를 병합한 화면용 관광지
 *
 * 공통 키가 없으므로 좌표 200m 이내 + 이름 유사도로 매칭한다.
 * 매칭 실패 시 hub 정보만으로 표시하고 이미지는 폴백 처리한다.
 */
export interface Spot {
  /** hubTatsCd 또는 contentid */
  id: string
  name: string
  /** 방문 기반 인기 순위. 병합 실패 시 null */
  rank: number | null
  category: string
  lat: number
  lng: number
  /** KorService2에서 병합. 없을 수 있다. */
  address?: string
  description?: string
  imageUrl?: string
  contentId?: string
  /** 현재 위치로부터의 직선거리(m). 계산해서 채운다. */
  distance?: number
  /** 추정 도보 시간(분) */
  walkMinutes?: number
}

/** 음식점 */
export interface FoodPlace extends Spot {
  /** '찜닭' | '헛제삿밥' | '간고등어·한식' | '카페·베이커리' */
  foodCategory: string
  tel?: string
}
