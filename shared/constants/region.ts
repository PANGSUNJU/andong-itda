import type { FoodCategory } from '../types/tour.ts'

/**
 * 안동시 지역 코드
 *
 * 같은 "안동시"를 가리키는 코드가 API마다 다르다.
 * 파라미터 이름과 값이 모두 다르므로 섞어 쓰면 빈 응답을 받는다.
 *
 *   KorService2 / EngService2  areaCode=35 sigunguCode=11  또는  lDongRegnCd=47 lDongSignguCd=170
 *   LocgoHubTarService1        areaCd=47   signguCd=47170
 *
 * 35/11은 한국관광공사 자체 지역 코드 체계이고, 47/170은 행정표준코드(법정동 코드)다.
 */

/**
 * 법정동 코드 — KorService2·EngService2가 받는 두 체계 중 **넓은 쪽**
 *
 * 같은 API가 지역 필터를 두 벌 받는데 잡히는 양이 다르다. 실측(2026-08-23):
 *
 *   조회             areaCode=35 & sigunguCode=11   lDongRegnCd=47 & lDongSignguCd=170
 *   관광지(12)                 63건                          107건
 *   문화시설(14)               11건                           26건
 *   축제(15)                    0건                            7건
 *   음식점(39)                 15건                           27건
 *   영문(EngService2)          32건                           57건
 *
 * 하회마을·도산서원·월영교·병산서원·봉정사·만휴정이 앞쪽에는 전부 없고 뒤쪽에는 전부 있다.
 * 이 항목들은 상류에서 `areacode`·`sigungucode`가 빈 값이고 법정동 코드만 채워져 있다.
 * **레코드 자체는 처음부터 있었다.** ADR-004가 "KorService2에 없다"고 적은 것도,
 * 08-02가 "이름으로 재검색해야 찾을 수 있다"고 적은 것도 증상에 맞춘 진단이었다.
 * 원인은 조회 파라미터다. → ADR-034
 *
 * ⚠️ `lDongSignguCd`는 **`170`이다. `47170`을 주면 오류 없이 조용히 0건이 온다.**
 *    LocgoHub는 같은 법정동 코드를 `47170`으로 받는다. 체계는 같은데 API마다 자르는
 *    위치가 다르다. 이 두 상수를 섞으면 목록이 통째로 비고, 에러도 안 난다.
 */
export const KOR_SERVICE_LDONG_REGION = {
  lDongRegnCd: '47',
  lDongSignguCd: '170',
} as const

/**
 * 관광공사 자체 지역 코드 — 이제 음식점만 쓴다
 *
 * 관광지·문화시설·영문은 위의 법정동 코드로 옮겼다. 음식점을 함께 옮기지 않은 이유는
 * 범위가 15건 → 27건으로 **늘어나기 때문**이다. 늘어나는 12곳이 무엇인지, 향토음식
 * 태깅(ADR-023)이 그 이름들에도 성립하는지 확인하지 않고 옮기면 분류 근거가 흐려진다.
 * 콜드스타트를 고치는 작업에 데이터 범위 변경을 얹지 않는다. 별도로 옮긴다.
 */
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
 * 건수는 2026-08-23 법정동 코드 조회 실측이다. 괄호 안은 옛 지역 코드로 봤을 때의 값으로,
 * 이 서비스가 오래 "안동에 없다"고 알고 있던 숫자다. → KOR_SERVICE_LDONG_REGION
 */
export const CONTENT_TYPE = {
  /** 관광지 — 107건 (옛 조회 63건) */
  TOURIST_SPOT: '12',
  /** 문화시설 — 26건 (옛 조회 11건) */
  CULTURAL_FACILITY: '14',
  /**
   * 축제·공연·행사 — 7건 (옛 조회 0건)
   *
   * ⚠️ 이 상수를 `areaBasedList2`에 쓰지 않는다. 그 응답에는 `eventstartdate`가
   *    없어서 진행 여부를 판정할 수 없다. 축제는 `searchFestival2` 전용 엔드포인트로
   *    조회한다(→ `fetchFestivals`). 여기 남겨 두는 것은 코드 체계의 기록이다.
   *
   * 옛 조회의 0건이 ADR-010("축제 데이터가 없어 제외")의 근거였다. → ADR-035
   */
  FESTIVAL: '15',
  /** 여행코스 */
  TRAVEL_COURSE: '25',
  /** 레포츠 */
  LEISURE: '28',
  /** 숙박 */
  ACCOMMODATION: '32',
  /** 쇼핑 */
  SHOPPING: '38',
  /** 음식점 — 27건이지만 아직 옛 조회로 15건만 본다. → KOR_SERVICE_REGION */
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
