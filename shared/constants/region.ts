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
 * 관광공사 자체 지역 코드 — **이제 아무도 쓰지 않는다**
 *
 * 마지막까지 남아 있던 음식점도 2026-09-10에 법정동 코드로 옮겼다(→ ADR-039).
 * 실측: 15건 → **28건**, 빠지는 곳 0. 찜닭이 1곳에서 6곳이 됐다 — 안동의 대표
 * 음식인데 목록에 한 곳뿐이었던 것이 조회 방식 때문이었다.
 *
 * 지우지 않고 남긴다. 이 상수가 무엇이었고 왜 물러났는지가 ADR-034·ADR-035·
 * ADR-039를 잇는 기록이다. 새로 쓰지 말 것.
 *
 * @deprecated 법정동 코드(`KOR_SERVICE_LDONG_REGION`)를 쓴다.
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
  /** 음식점 — 28건 (옛 조회 15건) → ADR-039 */
  RESTAURANT: '39',
} as const

export type ContentTypeId = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE]

/**
 * 음식점 분류 코드 — API가 주는 유일한 구분
 *
 * ⚠️ **`cat3`가 아니라 `lclsSystm2`를 본다.** 예전에는 반대였다. "cat3가 두 API에
 *    공통으로 있으므로"가 그때의 근거였는데, 법정동 코드로 조회하니 그 전제가
 *    무너졌다 — 새로 들어온 13곳은 **`cat1`·`cat2`·`cat3`가 전부 빈 문자열**이고
 *    `lclsSystm1`·`2`·`3`만 13/13 채워져 온다(실측 2026-09-10).
 *
 *    옛 15건에서 둘의 대응은 정확히 1:1이었다(A05020100↔FD01, A05020900↔FD05).
 *    그래서 옮겨도 옛 레코드의 분류는 한 건도 바뀌지 않는다. → ADR-039
 *
 * ⚠️ 향토음식(찜닭·헛제삿밥·간고등어) 구분은 **여기에 없다.** API는 한식/카페만 준다.
 *    ADR-011의 향토음식 분류표는 사람이 아는 사실로 만든 것이다. → ADR-023
 */
export const FOOD_LCLS = {
  /** 한식 */
  KOREAN: 'FD01',
  /** 카페·디저트 */
  CAFE: 'FD05',
} as const

/**
 * 옛 분류 코드. 법정동 조회 레코드에는 비어서 오지만, 상류가 다시 채우거나
 * 옛 조회로 받은 레코드가 섞여 들어올 때를 대비해 폴백으로 남긴다.
 */
export const FOOD_CAT3 = {
  KOREAN: 'A05020100',
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
