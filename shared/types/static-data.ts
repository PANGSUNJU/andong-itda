/**
 * 정적 데이터 타입
 *
 * 공공 API가 제공하지 않아 직접 만든 데이터다.
 * server/data/ 에 위치하며 클라이언트 번들에 포함되지 않는다.
 */

/** 관광지의 방향별 정류장·노선 정보 */
export interface SpotStation {
  stationId: number | null
  stationNm?: string
  stationOrd?: number
  gpsX?: number
  gpsY?: number
  routeId?: number
  routeNum?: string
  routeNm?: string
  /**
   * false면 도착정보 조회가 원리적으로 불가능하다.
   * 기점 정류장은 접근 중인 차량이 없기 때문이다. → ADR-015
   */
  realtimeAvailable?: boolean
}

/** 계절·기간 한정 노선 */
export interface SeasonalRoute {
  routeId: number
  routeNum: string
  note: string
  departTimes?: string[]
}

/** 관광지별 운행 시간표 */
export interface SpotTimetable {
  outboundFrom?: string
  departFirst?: string
  departLast?: string
  arriveFirst?: string
  arriveLast?: string
  runs?: number
  returnFrom?: string
  returnFirst?: string
  returnLast?: string
  returnRuns?: number
  /**
   * 귀로 시간표 존재 여부.
   * 공식 시간표는 안동 기준으로만 작성되어 관광 노선의 귀로가 대부분 없다.
   * false일 때 추정치를 막차처럼 표시하지 말 것. → ADR-016
   */
  returnTimesKnown?: boolean
  effectiveFrom?: string
  note?: string
  /** 화면에서 강하게 경고해야 하는 정보 */
  warning?: string
}

/** 관광지 ↔ 정류장 ↔ 노선 매핑 */
export interface SpotStationMapEntry {
  spot: string
  hubRank: number
  area: string
  inbound: SpotStation
  outbound: SpotStation
  seasonal?: SeasonalRoute[]
  shuttle?: { routeId: number; routeNm: string }[]
  routeInfo?: {
    routeId: number
    stationCnt: number
    routeLen: number
    startStation: { id: number; name: string }
    endStation: { id: number; name: string }
    note?: string
  }
  timetable: SpotTimetable
}

/** 아직 정류장을 확인하지 못한 관광지 */
export interface PendingSpot {
  spot: string
  area: string
  action: string
}

export interface SpotStationMap {
  _meta: {
    description: string
    verifiedAt: string
    rules: Record<string, string>
    verified: Record<string, string>
  }
  spots: SpotStationMapEntry[]
  pending: PendingSpot[]
}

/**
 * 관광지 통합 버스 정보 — /api/spot-bus/[spot] 응답
 *
 * 실시간 · 정적 시간표 · 운행 여부 세 소스를 결합한다.
 * 이 서비스의 핵심 엔드포인트다.
 */
export interface SpotBusInfo {
  spot: string
  /** 시내 → 관광지. 실시간 조회 가능 */
  inbound: {
    stationNm: string
    arrivals: {
      routeNum: string
      via: string
      predictTm: number | null
      remainStation: number | null
    }[]
  } | null
  /** 관광지 → 시내. 실시간 조회 불가 */
  outbound: {
    hasRealtime: false
    reason: string
  }
  schedule: SpotTimetable
  service: {
    runTotCnt: number
    /** runTotCnt > 0 */
    isOperating: boolean
  }
  /** 'arriving' | 'waiting' | 'closed' */
  status: string
  warning: string | null
}
