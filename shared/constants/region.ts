import type { FoodCategory } from '../types/tour.ts'

/**
 * 안동시 지역 코드
 *
 * 같은 "안동시"를 가리키는 코드가 API마다 다르다.
 * 파라미터 이름과 값이 모두 다르므로 섞어 쓰면 빈 응답을 받는다.
 *
 *   KorService2         areaCode=35  sigunguCode=11
 *   LocgoHubTarService1 areaCd=47    signguCd=47170
 *
 * 47170은 행정표준코드(법정동 코드)와 같은 값이고,
 * 35/11은 한국관광공사 자체 지역 코드 체계다.
 */

/** 국문 관광정보 서비스 (KorService2) */
export const KOR_SERVICE_REGION = {
  areaCode: '35',
  sigunguCode: '11',
} as const

/** 기초지자체 중심관광지 정보 (LocgoHubTarService1) */
export const LOCGO_HUB_REGION = {
  areaCd: '47',
  signguCd: '47170',
} as const

/** 안동시 govCd — 버스 API 응답 필터링에 사용 */
export const ANDONG_GOV_CD = '354'

/**
 * TourAPI 관광 타입 코드
 *
 * 안동 건수는 2026-07-23 실제 조회 결과다.
 * 축제(15)가 0건이므로 축제 연동 기능은 제외했다. → ADR-010
 */
export const CONTENT_TYPE = {
  /** 관광지 — 64건 */
  TOURIST_SPOT: '12',
  /** 문화시설 — 12건 */
  CULTURAL_FACILITY: '14',
  /** 축제·공연·행사 — 0건 */
  FESTIVAL: '15',
  /** 여행코스 */
  TRAVEL_COURSE: '25',
  /** 레포츠 */
  LEISURE: '28',
  /** 숙박 */
  ACCOMMODATION: '32',
  /** 쇼핑 */
  SHOPPING: '38',
  /** 음식점 — 16건 */
  RESTAURANT: '39',
} as const

export type ContentTypeId = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE]

/**
 * 음식점 cat3 코드 — API가 주는 유일한 구분
 *
 * 안동 음식점 16건의 cat3는 이 두 값뿐이고 lclsSystm2(FD01/FD05)와 1:1이다.
 * 둘 중 아무거나 써도 되지만 cat3가 두 API에 공통으로 있으므로 이쪽을 쓴다.
 *
 * ⚠️ 향토음식(찜닭·헛제삿밥·간고등어) 구분은 **여기에 없다.** API는 한식/카페만 준다.
 *    ADR-011의 향토음식 분류표는 사람이 아는 사실로 만든 것이다. → ADR-023
 */
export const FOOD_CAT3 = {
  /** 한식 — 11건 */
  KOREAN: 'A05020100',
  /** 카페·디저트 — 5건 */
  CAFE: 'A05020900',
} as const

/**
 * 식도락 분류의 표시 순서 — 그리고 그게 곧 기본 정렬이다
 *
 * 관광지 탭은 칩 목록을 응답에서 만든다. 분류를 상류가 정하기 때문이다(→ browse.vue).
 * 음식점은 반대다. 분류가 우리가 만드는 닫힌 집합이라 순서도 우리가 정해야 한다.
 * 향토음식을 앞에 둔다. 음식점에는 hubRank가 없어서 "인기순"이라는 축이 아예 없다.
 */
export const FOOD_CATEGORY_ORDER: readonly FoodCategory[] = ['찜닭', '헛제삿밥', '한식', '카페']
