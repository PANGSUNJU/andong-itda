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
  /**
   * 출발지의 영문
   *
   * `outboundFrom`·`returnFrom`은 공식 시간표의 정류장을 **우리가 줄여 쓴** 말이다
   * ("교보건너" = 교보생명 건너편). 그래서 상류 응답에 그대로 대응되는 값이 없다.
   *
   * ⚠️ 로마자로 지어내지 않는다. 여기 적는 영문은 전부 **상류 정류장 목록의
   *    `stationEngNm`을 그대로 옮긴 것**이다(`/api/bus/stations`, 2105곳 전부
   *    채워져 온다). "건너"까지 상류 표기(`Opposite Side`)를 따른다 — 현장
   *    표지판과 같은 글자여야 그 이름으로 정류장을 찾을 수 있다. → ADR-030 · ADR-032
   *
   * 비어 있으면 화면이 국문으로 되돌린다(`d.pick`).
   */
  outboundFromEn?: string
  departFirst?: string
  departLast?: string
  arriveFirst?: string
  arriveLast?: string
  runs?: number
  returnFrom?: string
  /** 귀로 출발지의 영문. 근거는 `outboundFromEn`과 같다. */
  returnFromEn?: string
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
 * 목적지로 데려다주는 노선 하나
 *
 * ⚠️ `routeNum`을 담지 않는다. 그 값은 `/api/bus/routes`(1분 캐시)에 있고,
 *    담는 순간 이 응답의 수명이 1분으로 끌려온다. 화면에 번호를 쓸 곳에는 이미
 *    도착정보(`BusArrival.routeNum`)가 있으므로 여기서 다시 말할 이유가 없다.
 *    이 응답은 노선의 정류장 순서만 보므로 하루를 산다.
 */
export interface SpotBoardingRoute {
  routeId: number
  /**
   * 목적지 하차 정류장의 노선상 순번. 이 수보다 **앞**에서 타야 목적지로 간다.
   *
   * ⚠️ **상류 눈금(`BusArrival.stationOrd`)이다. 1부터 센다.** `route-stations.json`의
   *    배열 인덱스는 0부터라 그대로 내보내면 1씩 작다. 그 상태로 `arrival.stationOrd <
   *    destOrd`를 재면 **바로 다음 정거장이 목적지인 버스가 탈락한다** — 가장 먼저
   *    타야 할 차가 빠지는 셈이다. 실측(2026-09-16): 노하동입구(ord 38)에서 110번을
   *    타면 다음이 안동역인데(인덱스 38 = ord 39), 인덱스로 재면 `38 < 38`이라 거짓.
   */
  destOrd: number
  /**
   * 하차 정류장.
   *
   * 총 소요시간을 재려고 담는다. 타는 시간은 **승차 정류장 → 하차 정류장**이고,
   * 목적지까지의 마지막 구간은 걷는 시간(`walkMeters`)이라 따로 세야 한다. 하차
   * 정류장 좌표가 없으면 그 둘이 겹쳐 계산된다. 좌표는 브라우저가 이미 들고 있는
   * 정류장 목록에서 이 id로 찾는다. → ADR-024(좌표는 서버로 가지 않는다)
   */
  stationId: number
  /** 하차 정류장에서 목적지까지 직선거리(m) */
  walkMeters: number
}

/**
 * 목적지행 판정 자료 — /api/spot-boarding/[id] 응답
 *
 * "지금 오는 이 버스가 나를 거기 데려다주는가"에 답하기 위한 것이다.
 *
 * ⚠️ **판정을 서버가 하지 않는다.** 서버는 목적지 쪽 사실만 주고, 내 정류장과
 *    대조하는 계산은 브라우저에서 한다. 그래야 "내가 어디 있는지"가 서버로
 *    나가지 않는다 — 좌표든 정류장 ID든 마찬가지다. → ADR-024
 *
 * ⚠️ **노선이 목적지를 지난다는 것만으로는 부족하다.** 같은 노선이어도 내
 *    정류장이 목적지보다 뒤면 그 차는 이미 지나쳤다. 반드시 순번을 비교해야
 *    한다(`arrival.stationOrd < destOrd`). 안동은 방향별로 routeId가 다르므로
 *    (ADR-007) 순번 비교 하나로 방향까지 갈린다. → ADR-025의 연장
 */
export interface SpotBoarding {
  spot: string
  /** 비어 있으면 이 목적지로 **직행하는 노선이 없다**. 환승은 아직 계산하지 않는다. */
  routes: SpotBoardingRoute[]
  /**
   * 위 노선들에서 목적지보다 앞선 정류장 전부 — 여기서 타면 목적지에 닿는다.
   *
   * 승강장 칩을 다시 세우는 데 쓴다. 도착 목록만 걸러서는 "이 정류장엔 없다"까지만
   * 알려주고 **어디로 가야 하는지는 여전히 말하지 못하기** 때문이다.
   */
  boardingStations: number[]
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
