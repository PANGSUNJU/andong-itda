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
 * 음식점 세부 분류
 *
 * 기획서에 명시한 안동 향토음식 카테고리에 대응한다.
 * cat3 코드는 KorService2 응답 기준.
 */
export const FOOD_CATEGORY = {
  /** 한식 — 헛제삿밥, 찜닭, 간고등어 */
  KOREAN: 'A05020100',
  /** 카페·디저트 */
  CAFE: 'A05020900',
} as const

/** 위치 정보를 얻지 못했을 때의 기준점 — 안동역 */
export const FALLBACK_LOCATION = {
  name: '안동역',
  lat: 36.5606,
  lng: 128.7274,
} as const

/**
 * 도보 속도
 *
 * 직선거리에 보정계수를 곱해 실제 도보 시간을 추정한다.
 * 실제 도보 경로 API를 쓰지 않는 이유는, 이 서비스에서 도보 시간의 역할이
 * "정확한 안내"가 아니라 "버스 대기 시간 안에 갈 수 있는지" 판단이기 때문이다.
 * ±2분 오차는 그 판단을 바꾸지 않는다.
 *
 * 화면에는 "약 4분"처럼 추정치임을 드러내 표기한다.
 */
export const WALK = {
  /** 분당 이동 거리(m) — 성인 평균 보행 속도 4km/h */
  METERS_PER_MINUTE: 67,
  /** 직선거리 → 실제 도보거리 보정계수 */
  DETOUR_FACTOR: 1.3,
} as const
