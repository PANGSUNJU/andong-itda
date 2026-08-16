/**
 * 안동시 버스정보 API 타입
 *
 * 베이스: http://bus.andong.go.kr/m01/s04.do
 * 인증키 불필요. http이므로 서버 프록시 경유 필수.
 *
 * ⚠️ 아래 타입은 모두 **실제 호출 응답**을 기준으로 작성했다.
 *    공식 명세서와 필드가 다르다. 명세서를 신뢰하지 말 것. → ADR-006
 *
 *    명세서에 있으나 오지 않는 필드:  rstop, provideType
 *    명세서에 없으나 오는 필드:      predictTm, remainStation, via, runTotCnt
 */

/** 정류장 목록 — `?tab=1` */
export interface BusStation {
  stationId: number
  stationNm: string
  /** 다국어 정류장명. 2단계 다국어 지원 시 활용 가능하다. */
  stationEngNm: string | null
  stationChnNm: string | null
  stationJpnNm: string | null
  /** 경도 */
  gpsX: number
  /** 위도 */
  gpsY: number
  /** 버스정보안내기(BIT) 설치 여부 */
  isBit: 0 | 1
  bitId: string | null
  mobiNum: string | null
  cardNum: string | null
  /** 안동시는 "354" */
  govCd: string
  govCdNm: string | null
  /** 'N'이면 폐지된 정류장. 반드시 필터링한다. */
  useYn: 'Y' | 'N'
  updateDt: string
}

/**
 * 정류장 목록 응답 — `/api/bus/stations`
 *
 * 상류 BusStation 14필드 중 화면과 거리 계산이 쓰는 것만 남긴 모양이다.
 * 실측(2026-08-06): 전체를 그대로 내려보내면 1,479KB, 이 모양이면 153KB(gzip 31KB)다.
 * 1.86MB라서 브라우저로 못 내려보낸다고 적어 뒀던 것은 안 쓰는 필드 10개였다.
 *
 * 브라우저가 이 목록을 통째로 받아 최근접 정류장을 직접 고른다.
 * 사용자 좌표를 서버로 보내지 않기 위해서다. → ADR-024
 *
 * 상류의 gpsX/gpsY 대신 lat/lng으로 바꿔 내보낸다. X가 경도, Y가 위도라 매번
 * 뒤집히고, 이름을 맞춰 두면 `nearest()`가 관광지와 정류장에 같은 함수로 돈다.
 */
export interface StationPin {
  stationId: number
  stationNm: string
  /**
   * 영문 정류장명.
   *
   * 상류가 2107곳 **전부** 채워서 준다(실측 2026-08-16). 관광지 영문이 26%뿐인 것과
   * 대조적이다. 외국인 여행자가 가장 먼저 막히는 게 "내가 선 정류장이 어디인가"인데
   * 이 필드는 커버리지가 완전해서 값이 크다.
   */
  nameEn?: string
  lat: number
  lng: number
  /**
   * 방면 — 노선상 다음 정류장의 이름. 카카오·네이버가 붙이는 그 꼬리표다.
   *
   * 정류장 2105곳 중 1644곳이 다른 정류장과 이름이 같다. 실측: "안동역(안동터미널)"이
   * 셋(354000416·354000459·354000536)이라 이름만으로는 어느 승강장인지 고를 수 없다.
   * 상류가 방면을 주지 않아 노선별 정류장 목록에서 미리 구워 둔다.
   * → `scripts/build-station-directions.ts`
   */
  direction?: string
  /**
   * 도착정보가 원리적으로 오지 않는 승강장(노선의 기점·종점으로만 등장한다).
   *
   * "접근 중인 차량"이 성립하지 않아 `tab=2`가 항상 빈 배열이다. → ADR-015
   * 실측(2026-08-13): 354000536은 종점 62 / 기점 6 / 중간 0개 노선 → 도착 0건.
   * 전체 2105곳 중 53곳이 여기 해당한다.
   */
  terminusOnly?: boolean
}

/** 거리가 채워진 정류장. `nearest()`의 반환값이다. */
export interface NearbyStation extends StationPin {
  /** 직선거리(m) */
  distance: number
  /** 추정 도보 시간(분). 직선거리 기반이므로 실제보다 짧게 나온다. */
  walkMinutes: number
}

/**
 * 정류장별 도착정보 — `?i={stationId}&tab=2`
 *
 * ⚠️ 기점 정류장은 항상 빈 배열을 반환한다.
 *    "접근 중인 차량"이라는 개념이 성립하지 않기 때문이다.
 *    검증: 하회 354002046(나가는 편) → [] / 354000701(들어오는 편) → 정상 응답
 *    → ADR-015
 */
export interface BusArrival {
  routeId: number
  /** 화면 주표시용 노선 번호. "212", "순환2-1", "급행3" 등 */
  routeNum: string
  /** 노선 전체명. "210(교보생명-하회마을)" */
  routeNm: string
  /**
   * 기점 → 종점. 명세서에 없지만 실제로는 온다.
   * 여행자가 버스에서 가장 혼란스러워하는 "이게 내가 가려는 방향인가"를
   * 해결하는 정보이므로 화면에 우선 노출한다.
   * 예: "교보생명 -> 하회마을"
   */
  via: string
  /** 이 정류장이 노선상 몇 번째인지 */
  stationOrd: number
  /**
   * 도착 예정 시간(분). 이미 계산되어 오므로 자체 계산 로직을 만들지 말 것.
   * null로 올 수 있다(차량 위치 미확보). 그때는 remainStation으로 대체 표시한다.
   */
  predictTm: number | null
  /** 남은 정류장 수 */
  remainStation: number | null
  /** 차량 ID. 차량번호를 변환한 값이다. 경북70자3403 → 147703403 */
  arrvVehId: number | null
  plateNo: string | null
  postPlateNo: string | null
  govCd: string
  govCdNm: string | null
}

/**
 * 이 버스가 앞으로 닿는 관광지
 *
 * `via`(기점 → 종점)만으로는 알 수 없다. 종점이 우연히 관광지일 때만 읽히고,
 * 종점이 안동터미널이면 그 버스가 도산서원을 지나는지 알 방법이 없다.
 * 노선상 순번을 비교해 "내 정류장보다 뒤"인 관광지만 담는다. → ADR-025
 */
export interface ArrivalSpot {
  name: string
  /** 내 정류장에서 몇 정거장 뒤인지 */
  stopsAway: number
}

/** 도착정보 + 이 버스가 닿는 관광지 — `/api/bus/arrivals` 응답 */
export interface ArrivalWithSpots extends BusArrival {
  /** 닿는 곳이 없거나 순번을 확인하지 못했으면 빈 배열이다. */
  spots: ArrivalSpot[]
}

/**
 * 노선 목록 — `?tab=3`
 *
 * 방향별로 별도 routeId가 존재한다. 시간표 문서에 귀로 시각이 생략되어
 * 있었을 뿐, 운행 자체는 왕복으로 등록되어 있다. → ADR-007
 *
 *   354300006  210(교보생명-하회마을)   가는 편
 *   354300008  210(하회마을-교보생명)   오는 편
 */
export interface BusRoute {
  routeId: number
  routeNum: string
  routeNm: string
  /**
   * 현재 운행 중인 차량 수.
   *
   * 이 서비스의 숨은 핵심이다. 도착정보가 비었을 때
   * "배차가 길어 대기 중"과 "오늘 운행 종료"를 구분하는 유일한 근거다.
   *
   * 검증(2026-07-29 수요일 호출):
   *   급행2 계열 = 0  (주말 전용 노선이므로 정확)
   *   210 하회 양방향 = 1
   *   순환1 = 4, 110번 = 5  (시내 노선)
   */
  runTotCnt: number
  stationCnt: number
  /** 노선 총 길이(m) */
  routeLen: number
  stStationId: number
  stStationNm: string
  edStationId: number
  edStationNm: string
  stNm: string | null
  upDstNm: string | null
  dnDstNm: string | null
  /**
   * ⚠️ 아래 시간표 관련 필드는 안동시가 입력하지 않아 전부 null이다.
   *    첫차·막차는 정적 시간표 데이터(server/data)에서 가져온다. → ADR-016
   */
  stTm: string | null
  edTm: string | null
  maxInterval: number | null
  minInterval: number | null
  runCnt: number | null
  useYn: 'Y' | 'N'
  govCd: string
}

/** 노선별 정류장 — `?i={routeId}&tab=4` */
export interface BusRouteStation {
  routeId: number
  /** 노선상 순번 */
  stationOrd: number
  stationId: number
  stationNm: string
  gpsX: number
  gpsY: number
  /** 기점으로부터의 누적 거리(m) */
  routeLen: number
  isBit: 0 | 1
  /** '0' 상행 / '1' 하행 */
  updnDir: string
  useYn: 'Y' | 'N'
}

/** 노선별 차량 위치 — `?i={routeId}&tab=5` (미검증) */
export interface BusVehicle {
  routeId: number
  vehId: number
  plateNo: string
  gpsX: number
  gpsY: number
  stationOrd: number
  stationId: number
  stationNm: string
}

/** 버스 API 오퍼레이션 */
export type BusApiTab = '1' | '2' | '3' | '4' | '5'

/**
 * 운행 상태 — 도착정보와 runTotCnt를 결합한 판정 결과
 *
 * 화면 문구가 여기서 갈린다.
 *   arriving → "12분 후"
 *   waiting  → "접근 중인 버스가 없어요. 배차가 길어요."
 *   closed   → "오늘 운행이 끝났어요." (경고)
 */
export type ServiceStatus = 'arriving' | 'waiting' | 'closed'
