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
  /**
   * note·warning의 영문
   *
   * 이 두 문장은 우리가 쓴 것이라 번역할 수 있다(상류가 준 이름·주소와 다르다).
   * 영문 화면에 그대로 두면 정보의 한계를 알리는 문장만 국문으로 남는데,
   * 그건 영어 사용자에게 가장 필요한 문장이다. → ADR-016 · ADR-031
   *
   * 비어 있으면 화면이 국문으로 되돌린다. 없는 번역을 기계로 지어내지 않는다.
   */
  noteEn?: string
  warningEn?: string
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
 * 노선 색인 — `server/data/route-stations.json`
 *
 * `scripts/build-station-directions.ts`가 굽는다. 노선 421개의 정류장 순서를
 * 통째로 들고 있어 400KB 남짓이지만 **서버에서만 읽는다.** 브라우저로 나가지 않는다.
 *
 * 요청 시점에 만들 수 없다. 만들려면 상류를 421번 불러야 하고, 그건 관광지 하나를
 * 여는 데 21초를 쓰는 일이다. 노선의 정류장 순서는 시간표만큼도 자주 바뀌지 않는다.
 * → ADR-016과 같은 판단
 */
export interface RouteStationIndex {
  routes: Record<
    string,
    {
      /** [정류장ID, 기점으로부터 누적 거리(m)] — 노선 순서 그대로 */
      stations: [number, number][]
      /**
       * 시내(안동역 반경 3km)에 드는 순번 전부. 비어 있으면 시내와 안 닿는 노선이다.
       *
       * 관광지보다 **앞선** 것이 하나라도 있으면 시내에서 타고 갈 수 있고,
       * **뒤** 것이 하나라도 있으면 타고 시내로 돌아올 수 있다. 순환 노선은 둘 다
       * 성립하는데 그게 맞다 — 같은 버스로 갔다가 계속 타고 돌아올 수 있다.
       *
       * 첫/마지막만 담지 않는다. 실제로 타는 사람은 관광지에 가장 가까운 시내
       * 정류장에서 타므로, "몇 정거장"을 세려면 그 순번을 고를 수 있어야 한다.
       */
      town: number[]
    }
  >
}

/**
 * 관광지로 가는(에서 오는) 노선 하나
 *
 * ⚠️ 이 값들은 **계산 결과**다. 사람이 확인한 `spot-station-map.json`과 근거가 다르다.
 *    화면은 둘을 같은 무게로 말하면 안 된다. → ADR-016의 연장
 */
export interface SpotRouteOption {
  routeId: number
  /** 화면 주표시. "210", "급행3" */
  routeNum: string
  /** 전체명. "210(교보생명-하회마을)" — 방향이 여기 들어 있다 */
  routeNm: string
  /** 지금 이 노선에서 운행 중인 차량 수. 0이면 오늘 운행이 끝났거나 미운행일이다 */
  runTotCnt: number
  /** 시내 거점에서 이 관광지까지 정거장 수 */
  stops: number
  /**
   * 노선 위 실제 도로 거리(m). 누적 거리의 차이라 직선거리가 아니다.
   * 홈 카드의 추정(`busMinutes`)과 달리 여기는 잰 값이다.
   */
  roadMeters: number
  /** 타고 내리는 정류장 */
  stationId: number
  stationNm: string
  stationNmEn?: string
  /** 그 정류장에서 관광지까지 직선거리(m) */
  walkMeters: number
}

/**
 * 관광지 노선 안내 — /api/spot-routes/[spot] 응답
 *
 * `/api/spot-bus`(실시간·시간표)와 별개다. 그쪽은 사람이 확인한 7곳만 답하고,
 * 이쪽은 노선 데이터만으로 44곳 전부에 답한다. 두 엔드포인트를 합치지 않는 이유는
 * 근거가 다르기 때문이다 — 하나가 실패해도 다른 하나는 남아야 한다.
 */
export interface SpotRouteInfo {
  spot: string
  /** 시내 → 관광지 */
  inbound: SpotRouteOption[]
  /** 관광지 → 시내 */
  outbound: SpotRouteOption[]
  /** 노선 번호로 묶기 전 개수. 화면이 "외 N개"를 말할 때 쓴다 */
  inboundTotal: number
  outboundTotal: number
  /**
   * 근처에 정류장은 있는데 그 정류장을 지나는 노선이 시내와 닿지 않는 상태.
   *
   * 실패가 아니라 답이다. 차 없는 여행자가 가장 알아야 할 사실이 "한 번에 가는
   * 버스가 없다"이므로, 빈 목록과 구분해서 말해야 한다.
   */
  disconnected: boolean
  /** 관광지 반경 안에서 후보로 본 정류장 수. 0이면 정류장 자체가 멀다 */
  nearbyStations: number
  /**
   * 안동 전체에 운행 중인 차량이 있는가.
   *
   * 목록의 노선이 전부 0일 때 "이 노선만 안 다닌다"와 "지금은 버스가 다니지 않는
   * 시간이다"를 가른다. 같은 화면의 실시간 카드와 같은 신호를 봐야 두 카드가
   * 서로 다른 말을 하지 않는다. → ADR-036
   */
  fleetRunning: boolean
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
    /**
     * 영문 정류장명. 정적 매핑에는 없고 `/api/bus/stations`에서 stationId로 이어 붙인다.
     * 상류가 2105곳 전부 채워 주므로 사실상 항상 있다. → ADR-030
     */
    stationNmEn?: string
    arrivals: {
      routeNum: string
      /**
       * 노선 전체명. 화면에 그대로 뜨지 않는다.
       * via의 종점이 비어서 올 때 방면을 여기서 건진다. → `formatDirection`
       * "610(만휴정-길안-국립경국대-교보건너-안동터미널)" → 안동터미널
       */
      routeNm: string
      via: string
      predictTm: number | null
      remainStation: number | null
    }[]
  } | null
  /** 관광지 → 시내. 실시간 조회 불가 */
  outbound: {
    hasRealtime: false
    reason: string
    reasonEn: string
  }
  schedule: SpotTimetable
  service: {
    runTotCnt: number
    /** runTotCnt > 0 */
    isOperating: boolean
    /**
     * 안동 **전체**에 운행 중인 차량이 있는가.
     *
     * 이 노선이 0일 때 "아직 안 다닌다"와 "다 끝났다"를 가르는 유일한 근거다.
     * 상류가 첫차·막차를 주지 않아(ADR-016) 시계로는 알 수 없다. → ADR-036
     */
    fleetRunning: boolean
  }
  /** 'arriving' | 'waiting' | 'closed' */
  status: string
  warning: string | null
  /** 영문이 없으면 null이다. 화면이 국문으로 되돌린다. */
  warningEn: string | null
}
