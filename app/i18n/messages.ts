/**
 * 화면 문구 사전 — 국문이 정본, 영문이 번역이다
 *
 * ADR-030은 "언어 전환을 만들지 않는다"였다. 그 근거는 커버리지였다. 관광지
 * 이름의 영문이 26%뿐이라, 문구만 영어로 바꾸면 이름 74%가 국문으로 남아
 * **반만 바뀐 화면**이 된다는 것이다. 그 지적은 지금도 맞다.
 *
 * 그래서 언어를 **주소로 가른다**(→ ADR-031). `/`가 국문, `/en`이 영문이다.
 * 토글로 같은 주소의 내용을 갈아끼우지 않는다. 그 함정은 정면으로 처리한다.
 *   문구      전부 번역한다. 여기 사전이 그것이다. 빠진 문구가 없어야 한다
 *   이름      영문이 있으면 영문, 없으면 국문 그대로 둔다(`useDisplay().name`)
 *   주소      국문만 있다. 번역하지 않는다 — 상류에 영문 주소가 없다
 *
 * 이름이 국문으로 남는 것은 숨기지 않는다. 여행자가 현장에서 볼 간판·표지판이
 * 국문이므로, 없는 영문명을 지어내는 것보다 국문을 그대로 보여주는 편이 맞다.
 * 지어낸 이름으로는 길을 물을 수 없다.
 *
 * ⚠️ 새 문구를 추가할 때는 `ko`에 먼저 넣는다. `en`은 `Messages` 타입을 만족해야
 *    하므로 빠뜨리면 타입 오류가 난다. 그게 이 구조를 쓰는 이유다.
 *
 * ⚠️ 값에 문자열 대신 함수를 쓰는 것은 보간이 필요할 때다. 템플릿 파서를 두지
 *    않는다. `{count}` 같은 자리표시자를 문자열에 넣으면 인자 개수·타입을
 *    컴파일러가 못 본다.
 */

/**
 * 언어 코드는 `shared/`가 갖는다. 사이트맵을 만드는 서버 라우트도 같은 것을
 * 봐야 하는데 서버는 `app/`을 읽지 못한다.
 *
 * ⚠️ **타입만** 들여온다. `import type`은 컴파일에서 통째로 지워지므로
 *    이 파일에 런타임 의존이 생기지 않는다. 그게 여기서 별칭(`#shared`)을
 *    써도 되는 이유이자, 반드시 타입만 들여와야 하는 이유다.
 *
 *    값(`LOCALES`)까지 여기서 다시 내보냈더니 빌드가 깨졌다. 번들러가 이 파일을
 *    거쳐 `shared/`로 가는 **런타임 경로**를 만들고, 그 상대경로가 출력 디렉터리
 *    밖으로 나가 Rollup이 해석하지 못한다. 값이 필요한 쪽(레이아웃·사이트맵)은
 *    `#shared/constants/locale`에서 직접 가져간다.
 *
 *    같은 이유로 `app/utils/format.ts`는 이 파일을 상대경로로 들여온다 —
 *    `scripts/*.ts`를 node로 직접 돌릴 때 별칭이 해석되지 않기 때문이다.
 *    타입만 오가는 이 줄은 node가 지우고 지나가므로 그 제약과 무관하다.
 */
import type { Locale } from '#shared/constants/locale'

export type { Locale }

/** 'YYYYMMDD' → [월, 일]. 축제 기간 표기가 두 언어에서 이 조각을 쓴다. */
const monthDay = (value: string) => [Number(value.slice(4, 6)), Number(value.slice(6, 8))] as const

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const ko = {
  /** <html lang>. 스크린리더가 어느 언어로 읽을지 정한다. */
  htmlLang: 'ko',
  /** 브랜드. 영문에서는 로마자 표기를 쓴다 — 워드마크가 아니라 텍스트다. */
  brand: '안동잇다',
  /** 검색 결과와 공유 카드에 뜨는 한 줄. 언어별 페이지가 각자의 것을 갖는다. */
  description:
    '차 없이 안동을 여행하는 사람을 위한 안내. 버스를 기다리는 시간에 다녀올 수 있는 곳을 알려드립니다.',

  nav: {
    home: '지금 여기',
    browse: '둘러보기',
    walk: '걷는 길',
  },

  footer: {
    about: '안내 · 데이터 출처',
    source: '한국관광공사 · 안동시 공공데이터',
  },

  /**
   * 언어 링크. 각 언어의 이름은 그 언어로 쓴다 — 읽을 사람이 그 언어 사용자다.
   * 버튼이 아니라 링크다. 누르면 같은 화면의 다른 주소로 간다. → ADR-031
   */
  lang: {
    label: '언어 선택',
    ko: '한국어',
    en: 'English',
  },

  common: {
    retry: '다시 시도',
    all: '전체',
    /** 개수 단위. "12곳" */
    places: (count: number) => `${count}곳`,
    minutesWalk: (minutes: number) => `걸어서 약 ${minutes}분`,
    stopsAway: (stops: number) => `${stops}정거장 전`,
    /** 큰 숫자 옆의 단위. 숫자만 크게 쓰고 단위는 작게 둔다. */
    minuteUnit: '분',
  },

  home: {
    title: '지금 여기 · 안동잇다',
    heading: (place: string) => `지금 ${place} 부근이에요`,
    sub: '가까운 정류장의 버스와, 기다리는 동안 다녀올 만한 곳이에요',
    locating: '위치를 확인하는 중이에요…',
    relocate: '내 위치로 다시',

    busErrorTitle: '버스 정보를 가져오지 못했어요.',
    busErrorBody: '안동시 버스정보 시스템이 응답하지 않고 있어요.',

    /**
     * ⚠️ "종점 승강장"이라고 적었었다. 이제 이 꼬리표가 붙는 19곳은 대부분
     *    **기점**이다(실측으로 종점은 도착이 온다 → ADR-037). 어느 쪽인지
     *    말하지 않고 결과만 적는다 — 여행자에게 필요한 건 그 사실이다.
     */
    terminusTag: '도착 정보가 없는 승강장',
    directionTag: (destination: string) => `${destination} 방면`,
    rightHere: '바로 앞이에요',
    walkFromHere: (distance: string, minutes: number) =>
      `${distance} · 걸어서 약 ${minutes}분`,

    mapCaption: (place: string, stops: number, spots: number) =>
      `${place} 반경 2km · 정류장 ${stops}곳 · 걸어갈 수 있는 관광지 ${spots}곳`,
    /**
     * 버스 모드. 이 지도에는 글자가 하나도 없다 — 이름표를 접었기 때문이다.
     * 누를 수 있다는 것과 원이 무엇인지, 둘 다 이 한 줄이 말해야 한다.
     */
    mapCaptionRide: (place: string, spots: number) =>
      `${place}에서 버스로 갈 수 있는 곳 ${spots}곳 · 핀을 누르면 소요 시간이 나와요 · 원 안은 도보 2km`,
    mapTabWalk: '걸어서',
    mapTabRide: '버스로',

    /** "걸어서 <em>갈 수 있는 곳</em>" — 뒷부분만 색을 준다. */
    walkableHeadLead: '걸어서 ',
    walkableHeadEmphasis: '갈 수 있는 곳',
    walkableSub: '버스를 기다리는 동안 다녀올 수 있어요',

    rideableHead: '버스로 갈 수 있는 가까운 곳',
    rideableSub: '걸어가기엔 멀어요. 돌아오는 편까지 함께 확인하세요',

    popularHead: '안동에서 많이 찾는 곳',
    popularSub: '한국관광공사 방문 데이터 기준',
    seeAll: '전체 보기',
  },

  /**
   * 오류 화면 — `app/error.vue`
   *
   * 이 화면이 없을 때 배포본은 `{"error":true,…,"message":"Server Error"}`를
   * 날것으로 뱉었다. 없는 관광지 링크 하나에 서비스가 고장 난 것처럼 보였다.
   */
  error: {
    title404: '이 주소에는 아무것도 없어요',
    body404: '주소가 바뀌었거나, 처음부터 없던 페이지예요.',

    titleServer: '잠시 문제가 생겼어요',
    /**
     * 원인을 우리 쪽으로만 적지 않는다. 이 서비스는 안동시·관광공사 API를 그대로
     * 조합하므로 상류가 멈추면 여기도 멈춘다. 그 사실을 숨기면 "다시 시도"가
     * 왜 통할 때가 있는지 설명되지 않는다.
     */
    bodyServer: '안동시 버스정보나 관광공사 데이터가 응답하지 않을 때도 이 화면이 떠요.',

    goHome: '지금 여기로',
    goBrowse: '둘러보기',
    retry: '다시 시도',
    /** 문의나 재현에 쓰라고 남기는 한 줄. 크게 보일 이유는 없다. */
    code: (status: number) => `오류 ${status}`,
  },

  browse: {
    title: '둘러보기 · 안동잇다',
    heading: '안동 둘러보기',
    tabSpots: '관광지',
    tabFood: '식도락',
    subSpots: (count: number) => `한국관광공사 방문 데이터에 잡힌 관광지 ${count}곳`,
    subFood: (count: number) => `한국관광공사에 등록된 안동 음식점 ${count}곳`,
    searchSpots: '관광지 이름으로 찾기',
    searchFood: '음식점 이름으로 찾기',
    searchLabel: (tab: string) => `${tab} 검색`,
    sortRank: '인기순',
    sortName: '이름순',
    empty: (keyword: string) => `"${keyword}"에 해당하는 곳이 없어요`,
    foodNote: '음식점 정보는 한국관광공사 데이터라 사진과 전화번호가 없는 곳이 있어요.',
    mapCaption: (tab: string, count: number) => `${tab} ${count}곳의 분포`,
  },

  walk: {
    title: '걷는 길 · 안동잇다',
    heading: '걷는 길',
    sub: '버스 없이 걸어서 이어지는 길만 골랐어요',
    summary: (km: number, minutes: number, terrain: string) =>
      `${km}km · 약 ${minutes}분 · ${terrain}`,
    /**
     * 걷는 길이 세 탭 중 유일하게 버스와 안 이어져 있었다. 버스를 기다리는 시간에
     * 다녀올 곳을 알려주는 서비스인데, 정작 "걷는 길"만 어떻게 가고 어떻게
     * 돌아오는지를 말하지 않았다. → ADR-038
     */
    busHead: '버스로 오가기',
    goLabel: '갈 때',
    backLabel: '올 때',
    /** 코스 끝에서 시내로 나가는 노선. 번호만 말한다 — 하차 정류장은 갈 때와 같다. */
    backFrom: (place: string) => `${place}에서`,
    startUnknown: '시작점까지 한 번에 오는 버스를 찾지 못했어요',
    /** 이 서비스에서 가장 위험한 실패가 "갈 수는 있는데 못 돌아오는" 안내다. → ADR-016 */
    returnUnknown: '돌아오는 편을 찾지 못했어요. 출발 전에 꼭 확인하세요',

    noticeConstruction: '낙강물길공원은 2028년까지 공사 중이라 코스에서 뺐어요.',
    noticeSource:
      '이 코스는 공공데이터에 없어서 저희가 직접 짰어요. 다른 정보와 달리 공식 자료가 아니에요.',
  },

  /**
   * 축제 — 있을 때만 나타나는 자리
   *
   * 상시 탭을 주지 않는다. 안동 축제는 7건이고 대부분의 날에 진행중이 0건이라,
   * 탭으로 두면 주 동선 셋이 좁아지는 대가로 빈 화면을 얻는다. → ADR-035
   */
  festival: {
    /** 헤더 아이콘의 접근성 이름. 아이콘만 있는 버튼이라 이게 유일한 이름이다. */
    iconLabel: (count: number) => `안동에서 열리는 축제 ${count}건 보기`,
    /** 아이콘 옆 한 글자짜리 상태. 진행중이 하나라도 있으면 이쪽이다. */
    chipNow: '축제',
    chipSoon: '축제 예정',

    title: '지금 안동에서',
    subOngoing: '축제가 열리고 있어요',
    subUpcoming: '곧 축제가 열려요',
    close: '닫기',

    /** "9월 24일 – 10월 4일". 하루짜리면 한 번만 적는다. */
    period: (start: string, end: string) => {
      const [startMonth, startDay] = monthDay(start)
      const [endMonth, endDay] = monthDay(end)
      const from = `${startMonth}월 ${startDay}일`
      if (start === end) return from
      return `${from} – ${startMonth === endMonth ? `${endDay}일` : `${endMonth}월 ${endDay}일`}`
    },

    now: '지금 열리고 있어요',
    lastDay: '오늘이 마지막 날이에요',
    endsIn: (days: number) => `${days}일 더 열려요`,
    startsTomorrow: '내일 시작해요',
    startsIn: (days: number) => `${days}일 뒤에 시작해요`,

    stationsHead: '가까운 정류장',
    /**
     * 이 한 줄이 정직성의 자리다. 관광지 버스 안내는 사람이 확인한 매핑이지만
     * 축제는 좌표에서 계산한 결과다. 근거가 다르면 다르다고 적는다. → ADR-016
     */
    stationNote: '축제장 좌표에서 가장 가까운 정류장을 계산했어요. 직접 확인한 매핑은 아니에요.',
    noStation: '축제장 1km 안에 등록된 정류장이 없어요.',
    arrivalsEmpty: '지금 이 정류장으로 접근 중인 버스가 없어요.',
    arrivalsError: '도착 정보를 가져오지 못했어요.',
    loading: '축제 정보를 불러오는 중…',

    source: '한국관광공사 축제·행사 정보',
  },

  spot: {
    notFound: '찾을 수 없는 관광지예요',
    title: (name: string) => `${name} · 안동잇다`,
    back: '← 둘러보기',
    rankLine: (rank: number) => `${rank}번째로 많이 찾는 곳`,

    aboutHead: '이런 곳이에요',
    accessHead: '가는 방법',
    /** 정류장 이름을 <b>로 감싸므로 앞뒤를 나눠 둔다. */
    getOffBefore: '',
    getOffAfter: '에서 내려요.',
    /** "210번{}하회마을에서 내려요" — 노선 번호와 정류장 이름 사이 */
    rideAnd: '을 타고 ',
    /** "시내에서 31정거장, 17.0km예요." */
    fromDowntown: (stops: number, distance: string) =>
      `시내에서 ${stops}정거장, ${distance}예요.`,
    schedule: (from: string, first: string, last: string) =>
      `${from}에서 첫차 ${first}, 막차 ${last}예요.`,
    returnUnknownLead: '돌아오는 편 시각은 공식 시간표에 없어요.',
    returnUnknownStrong: '도착하면 먼저 귀로 버스를 확인하세요.',
    busPendingBody: '이 관광지의 정류장은 아직 확인하지 못했어요. 임의로 채우지 않고 비워 둡니다.',
    busNoneBody: '버스 정보가 등록되지 않은 곳이에요. 현재는 인기 관광지 7곳만 안내하고 있어요.',
    directions: '카카오맵으로 길찾기',

    aroundHead: '근처에 함께 볼 곳',

    panelPendingTitle: '버스 안내 준비 중',
    panelPendingBody: '정류장을 확인하는 중이에요. 확인되지 않은 정류장을 추측해서 넣지 않아요.',
    panelNoneBody: '지금은 인기 관광지 7곳의 버스 정보를 안내하고 있어요.',
    mapCaption: (name: string) => `${name} 주변`,
  },

  /**
   * 노선 안내 — 44곳 전부에 답하는 자리
   *
   * 실시간 도착(`bus`)과 근거가 다르다. 그쪽은 사람이 확인한 승강장 7곳이고
   * 이쪽은 노선 데이터로 계산한 결과다. 그 차이를 `note`가 화면에서 말한다.
   * 근거가 다르면 다르다고 적는다. → ADR-016
   */
  spotRoutes: {
    head: '이 관광지에 오는 버스',
    inboundHead: '시내에서 오는 편',
    outboundHead: '시내로 나가는 편',
    /** "210번" — 노선 번호는 숫자가 아닌 것도 있다(급행3·순환2-1) */
    routeLabel: (routeNum: string) => `${routeNum}번`,
    getOff: (station: string) => `${station} 하차`,
    /** "31정거장 · 17.0km" */
    ride: (stops: number, distance: string) => `${stops}정거장 · ${distance}`,
    /** 내려서 걸어야 하는 거리. 30m 미만이면 formatDistance가 "바로 앞"으로 답한다. */
    thenWalk: (distance: string) => `내려서 ${distance}`,
    running: '운행 중',
    /**
     * 목록의 노선이 전부 0일 때. 안동 전체가 도는지에 따라 뜻이 갈린다 —
     * 실시간 카드와 같은 신호를 봐야 두 카드가 서로 다른 말을 하지 않는다.
     */
    idleRoute: '이 노선은 지금 차가 없어요',
    offHours: '지금은 버스가 다니지 않는 시간',
    more: (count: number) => `외 ${count}개 노선`,

    disconnectedTitle: '한 번에 가는 버스가 없어요',
    disconnectedBody:
      '근처에 정류장은 있지만, 그 정류장을 지나는 노선이 시내와 이어지지 않아요. 갈아타야 해요.',
    noneTitle: '가까운 정류장이 없어요',
    noneBody: '이 관광지에서 걸어갈 만한 거리에 등록된 정류장이 없어요.',

    /**
     * 이 한 줄이 정직성의 자리다. 관광지 7곳의 버스 안내는 사람이 확인한 매핑이지만
     * 이 목록은 좌표와 노선 순서로 계산한 결과다. → 축제의 `stationNote`와 같은 규칙
     */
    note: '관광지 근처 정류장을 지나는 노선을 계산했어요. 직접 확인한 안내는 아니에요.',
  },

  bus: {
    loading: '도착 정보를 불러오는 중…',
    directionsToStop: '이 정류장까지 길찾기',
    stationUnknown: '정류장 미확인',
    inboundFromDowntown: '시내에서 들어오는 편',
    /** 서버가 outboundFrom을 주지 않을 때의 기본 출발지 */
    downtown: '시내',

    arrivingSoon: (routeNum: string) => `${routeNum}번이 곧 도착해요`,
    onTheWay: (routeNum: string) => `${routeNum}번이 오고 있어요`,
    takesYouTo: (places: string) => `타면 ${places}에 가요`,
    nextSameRoute: (routeNum: string, minutes: number) =>
      `다음 ${routeNum}번은 ${minutes}분 후예요`,

    /** ArrivalRow 오른쪽 끝. 숫자 아래 붙는 한 글자. */
    after: '후',
    locating: '위치 확인 중',
    /** 도착 예정도 남은 정거장도 못 받았을 때. `formatArrival`의 마지막 갈래다. */
    noInfo: '정보 없음',

    terminusTitle: '이 승강장은 도착 정보가 뜨지 않아요',
    terminusBody1: "버스가 출발하거나 운행을 마치는 자리라 '접근 중인 버스'가 없어요.",
    terminusBody2: '아래에서 다른 승강장을 골라 주세요.',
    emptyTitle: '지금 이 정류장으로 접근 중인 버스가 없어요',
    emptyBody1: '배차 간격이 길어서일 수도, 오늘 운행이 끝나서일 수도 있어요.',
    emptyBody2: '다른 정류장을 확인해 보세요.',

    waitingTitle: '접근 중인 버스가 없어요',
    waitingBody: '노선은 운행 중이에요. 배차 간격이 길어 기다리면 옵니다.',
    /**
     * ⚠️ 이 자리에 "오늘 이 노선 운행이 끝났어요"가 있었다. 새벽 6시 반 월영교에서
     *    그 문장은 사실과 **정반대**였다(첫차 08:25). 문구가 시각을 주장하지
     *    않게 바꿨다 — "다니지 않는 시간"은 새벽에도 심야에도 참이다. → ADR-036
     */
    offHoursTitle: '지금은 버스가 다니지 않는 시간이에요',
    offHoursBody: '아래 시간표에서 첫차 시각을 확인하세요.',

    /**
     * 이 노선만 0이고 다른 노선은 도는 상태.
     *
     * 새벽만의 이야기가 아니다. 실측(2026-09-10 **12:42**): 월영교 112번은 하루
     * 7회라 점심때도 노선 위에 차가 한 대도 없다. 옛 문구는 그 시각에
     * "오늘 이 노선 운행이 끝났어요"라고 말하고 있었다.
     *
     * `waiting`과 다른 점은 차량 수다 — 저쪽은 돌고 있는데 아직 안 온 것이고,
     * 이쪽은 노선 위에 아예 없다. 그래서 "기다리면 옵니다"라고 말할 수 없다.
     * 첫차가 아니라 **운행 시각**을 가리킨다. 낮에 "첫차를 확인하세요"는 어긋난다.
     */
    routeIdleTitle: '이 노선은 지금 운행 중인 차가 없어요',
    routeIdleBody: '다른 노선은 다니고 있어요. 아래 시간표에서 운행 시각을 확인하세요.',

    departsFrom: (from: string) => `${from} 출발`,
    firstLast: (first: string, last: string) => `첫차 ${first} · 막차 ${last}`,
    runsPerDay: '하루 운행',
    runsCount: (runs: number) => `${runs}회`,
    returnTrip: '돌아오는 편',
    returnUnknownStrong: '돌아오는 편 시간표는 공식 자료에 없어요.',
    returnUnknownFallback: '현장에서 기사님께 막차 시각을 확인하세요.',
  },

  realtime: {
    live: '실시간',
    refresh: '도착 정보 새로고침',
    justNow: '방금',
    minutesAgo: (minutes: number) => `${minutes}분 전`,
    hoursAgo: (hours: number) => `${hours}시간 전`,
  },

  card: {
    rankBadge: (rank: number) => `${rank}위`,
    /**
     * 걸어가기엔 먼 곳. 거리 대신 타고 걸리는 시간을 말한다.
     * 기다리는 시간은 빠져 있다 — 그건 도착정보와 시간표가 답한다. → `busMinutes`
     */
    busRideMinutes: (minutes: number) => `버스로 약 ${minutes}분`,
    noPhoto: '사진 준비 중',
  },

  map: {
    reset: '처음 화면으로',
    failed: '지도를 불러오지 못했어요',
    pending: '지도 준비 중',
  },

  location: {
    origin: '안동역',
    current: '현재 위치',
    unsupported: '이 브라우저는 위치를 알려주지 못해요',
    outside: '안동 밖에 계신 것 같아 안동역을 기준으로 보여드려요',
    denied: '위치를 확인할 수 없어 안동역을 기준으로 보여드려요',
  },

  distance: {
    /** 30m 미만. 거리가 아니라 "여기"라고 말한다. */
    rightHere: '바로 앞',
  },

  about: {
    title: '안내 · 안동잇다',
    heading: '안내',
    sub: '이 서비스가 쓰는 데이터와, 알아두시면 좋은 것들이에요',

    sourcesHead: '데이터 출처',
    sourceSpotsTerm: '관광지 정보 · 사진 · 인기 순위',
    sourceSpotsDesc: '한국관광공사 TourAPI (공공누리)',
    /**
     * 축제는 화면에 늘 있지 않다(열릴 때만 아이콘이 뜬다). 그래서 출처는 여기에
     * 상시로 적어 둔다 — 축제가 없는 날에도 이 데이터를 쓴다는 사실은 남아야 한다.
     */
    sourceFestivalTerm: '축제 · 행사 기간',
    sourceFestivalDesc:
      '한국관광공사 TourAPI (공공누리) · 열리고 있거나 30일 안에 시작하는 축제만 보여드려요',
    sourceWalkTerm: '걷는 길 코스',
    sourceWalkDesc: '저희가 직접 짰어요 (공공데이터에 안동 걷기길이 없어요)',
    sourceBusTerm: '정류장 · 노선 · 실시간 도착',
    sourceBusDesc: '안동시 버스정보시스템',
    sourceTimetableTerm: '시내버스 운행시간표',
    sourceTimetableDesc: '안동시 공공데이터',
    sourcesNote:
      '각 저작물의 권리는 해당 기관에 있어요. 인기 순위는 한국관광공사의 방문 데이터를 그대로 따르고, 저희가 매기지 않아요.',

    limitsHead: '버스 정보의 한계',
    limitsRealtime:
      '도착 정보는 안동시 버스정보시스템의 실시간 데이터를 그대로 보여드려요. 현장 상황에 따라 실제와 다를 수 있어요.',
    limitsScheduleLead: '첫차 · 막차 시각은 안동시가 공개한 운행시간표에서 가져왔어요.',
    limitsScheduleStrong: '일부 노선은 공식 시간표에 돌아오는 편 시각이 없어요.',
    limitsScheduleTail:
      '그런 노선은 화면에 그 사실을 적어두고, 시각을 추측해서 채우지 않아요. 돌아오는 편은 도착하신 뒤 현장에서 꼭 확인해 주세요.',
    limitsMissed:
      '버스를 놓치면 다음 차까지 오래 기다려야 하는 노선이 많아요. 일정이 걸려 있는 이동은 안동시 교통 부서나 현장 안내로 한 번 더 확인해 주세요.',

    locationHead: '위치 정보',
    locationIntro:
      "'지금 여기' 화면에서 위치를 허용하시면, 브라우저가 알려준 좌표로 가까운 정류장과 걸어서 다녀올 만한 곳을 찾아드려요.",
    locationPoint1Lead: '좌표를 ',
    locationPoint1Strong: '저희 서버로 보내지 않아요.',
    locationPoint1Tail: ' 정류장을 고르는 계산까지 브라우저 안에서 끝나요',
    locationPoint2: '좌표를 저장하지 않아요. 데이터베이스가 없고, 화면을 벗어나면 사라져요',
    locationPoint3: '위치를 허용하지 않으셔도 안동역을 기준으로 똑같이 쓰실 수 있어요',
    locationCaveatLead: '두 가지는 밝혀둘게요.',
    locationCaveat1:
      '지도는 카카오맵으로 그려요. 지도를 표시할 때 브라우저가 카카오 서버에 지도 화면을 요청해요',
    locationCaveat2:
      '버스 도착 정보를 받으려면 어느 정류장인지는 알려야 해요. 정류장 번호로만 조회하고, 그 요청에 좌표는 들어가지 않아요',

    privacyHead: '개인정보',
    privacy1:
      '회원가입도 로그인도 없어요. 이름 · 연락처 · 결제 정보처럼 개인을 알아볼 수 있는 정보를 받지 않고, 그걸 담을 데이터베이스도 두지 않았어요.',
    privacy2:
      '웹사이트를 여는 것만으로 남는 접속 기록은 배포 환경이 자동으로 처리하는 부분이라, 저희가 따로 들여다보거나 다른 목적으로 쓰지 않아요.',

    /**
     * 만든 과정 — 저장소 링크
     *
     * 이 서비스의 판단 근거는 대부분 화면에 안 보이는 곳에 있다. 어느 정류장을
     * 왜 뒤로 미는지, 모르는 막차 시각을 왜 비워 두는지 같은 것들이다. 그 기록이
     * 저장소에 있는데 사이트 어디에도 가는 길이 없었다. 제출물이 URL 하나라
     * 링크가 없으면 아무에게도 닿지 않는다.
     *
     * 숫자를 적어 둔다. "결정 기록이 있어요"는 클릭할 이유가 안 되지만 "38건"은
     * 된다. ⚠️ ADR이 늘면 여기도 고친다. 틀린 숫자를 적느니 안 적는 편이 낫다.
     */
    sourceHead: '만든 과정',
    sourceBody:
      '화면에 보이지 않는 판단이 많아요. 어느 정류장을 왜 뒤로 미는지, 모르는 막차 시각을 왜 비워 두는지 같은 것들이에요. 그 결정을 38건의 기록으로 남겨 뒀어요.',
    sourceLink: '소스 코드와 결정 기록 (GitHub)',

    closing:
      '안동잇다는 한국관광공사 2026 관광데이터 활용 공모전 출품작이에요. 차 없이 안동을 여행하는 분들을 위해 만들었어요.',
  },
} as const

/**
 * 사전의 모양. `en`이 이 타입을 만족해야 하므로 번역 누락이 컴파일에서 잡힌다.
 *
 * `as const`를 벗겨 낸다. 리터럴 타입 그대로 두면 `en`의 문자열이 `ko`의
 * 리터럴과 달라 전부 타입 오류가 난다.
 */
type Messages = {
  [K in keyof typeof ko]: (typeof ko)[K] extends string
    ? string
    : {
        [P in keyof (typeof ko)[K]]: (typeof ko)[K][P] extends (...args: infer A) => string
          ? (...args: A) => string
          : string
      }
}

/**
 * 영문
 *
 * 직역하지 않는다. 국문이 "~해요"로 말을 거는 톤이라 영문도 사람이 말하듯 쓴다.
 * 다만 **정보의 한계를 밝히는 문장은 국문과 같은 강도로** 옮긴다. 그게 이
 * 서비스가 다른 안동 서비스와 갈리는 지점이고(ADR-016), 약하게 옮기면
 * 영어 사용자만 근거 없는 확신을 갖게 된다.
 */
const en: Messages = {
  htmlLang: 'en',
  brand: 'Andong Itda',
  description:
    'A guide for travelling Andong without a car. It shows what you can reach in the time you spend waiting for the bus.',

  nav: {
    home: 'Right Now',
    browse: 'Explore',
    walk: 'Walking Routes',
  },

  footer: {
    about: 'About · Data Sources',
    source: 'Korea Tourism Organization · Andong City Open Data',
  },

  lang: {
    label: 'Select language',
    ko: '한국어',
    en: 'English',
  },

  common: {
    retry: 'Try again',
    all: 'All',
    places: (count: number) => `${count} ${count === 1 ? 'place' : 'places'}`,
    minutesWalk: (minutes: number) => `about ${minutes} min walk`,
    stopsAway: (stops: number) => `${stops} ${stops === 1 ? 'stop' : 'stops'} away`,
    minuteUnit: 'min',
  },

  home: {
    title: 'Right Now · Andong Itda',
    heading: (place: string) => `You're near ${place}`,
    sub: 'Buses from the nearest stop, and places worth a look while you wait',
    locating: 'Finding your location…',
    relocate: 'Use my location',

    busErrorTitle: "Couldn't load bus information.",
    busErrorBody: "Andong's bus information system isn't responding right now.",

    terminusTag: 'No arrival info at this platform',
    directionTag: (destination: string) => `Toward ${destination}`,
    rightHere: "It's right in front of you",
    walkFromHere: (distance: string, minutes: number) =>
      `${distance} · about ${minutes} min walk`,

    mapCaption: (place: string, stops: number, spots: number) =>
      `Within 2 km of ${place} · ${stops} stops · ${spots} places within walking distance`,
    mapCaptionRide: (place: string, spots: number) =>
      `${spots} places you can reach by bus from ${place} · tap a pin for the ride time · the circle is a 2 km walk`,
    mapTabWalk: 'On foot',
    mapTabRide: 'By bus',

    walkableHeadLead: 'Places you can ',
    walkableHeadEmphasis: 'walk to',
    walkableSub: 'Close enough to visit while you wait for the bus',

    rideableHead: 'Nearby, but you will want the bus',
    rideableSub: 'Too far to walk. Check the return trip before you go',

    popularHead: 'Most visited in Andong',
    popularSub: 'Based on Korea Tourism Organization visit data',
    seeAll: 'See all',
  },

  error: {
    title404: "There's nothing at this address",
    body404: 'The address may have changed, or the page never existed.',

    titleServer: 'Something went wrong',
    bodyServer:
      'This screen also appears when the Andong bus system or the Korea Tourism Organization data is not responding.',

    goHome: 'Go to Right Now',
    goBrowse: 'Explore',
    retry: 'Try again',
    code: (status: number) => `Error ${status}`,
  },

  browse: {
    title: 'Explore · Andong Itda',
    heading: 'Explore Andong',
    tabSpots: 'Places',
    tabFood: 'Food',
    subSpots: (count: number) => `${count} places in Korea Tourism Organization visit data`,
    subFood: (count: number) =>
      `${count} Andong restaurants registered with the Korea Tourism Organization`,
    searchSpots: 'Search places by name',
    searchFood: 'Search restaurants by name',
    searchLabel: (tab: string) => `Search ${tab}`,
    sortRank: 'Most visited',
    sortName: 'By name',
    empty: (keyword: string) => `Nothing matches "${keyword}"`,
    foodNote:
      'Restaurant data comes from the Korea Tourism Organization, so some entries have no photo or phone number.',
    mapCaption: (tab: string, count: number) => `${count} ${tab.toLowerCase()} on the map`,
  },

  walk: {
    title: 'Walking Routes · Andong Itda',
    heading: 'Walking Routes',
    sub: 'Routes that connect on foot — no bus needed',
    summary: (km: number, minutes: number, terrain: string) =>
      `${km} km · about ${minutes} min · ${terrain}`,
    busHead: 'Getting there and back',
    goLabel: 'There',
    backLabel: 'Back',
    backFrom: (place: string) => `From ${place}`,
    startUnknown: 'We could not find a single bus to the start',
    returnUnknown: 'We could not find a way back. Check before you set out',

    noticeConstruction:
      'Nakgang Water Trail Park is under construction until 2028, so we left it out.',
    noticeSource:
      'These routes are not in any public dataset — we put them together ourselves. Unlike everything else here, they are not official.',
  },

  festival: {
    iconLabel: (count: number) => `See ${count} ${count === 1 ? 'festival' : 'festivals'} in Andong`,
    chipNow: 'Festival',
    chipSoon: 'Festival soon',

    title: 'In Andong right now',
    subOngoing: 'A festival is on',
    subUpcoming: 'A festival is about to start',
    close: 'Close',

    period: (start: string, end: string) => {
      const [startMonth, startDay] = monthDay(start)
      const [endMonth, endDay] = monthDay(end)
      const from = `${EN_MONTHS[startMonth - 1]} ${startDay}`
      if (start === end) return from
      return `${from} – ${startMonth === endMonth ? `${endDay}` : `${EN_MONTHS[endMonth - 1]} ${endDay}`}`
    },

    now: 'Happening now',
    lastDay: 'Today is the last day',
    endsIn: (days: number) => `${days} more ${days === 1 ? 'day' : 'days'}`,
    startsTomorrow: 'Starts tomorrow',
    startsIn: (days: number) => `Starts in ${days} days`,

    stationsHead: 'Nearest stops',
    stationNote:
      "We calculated the nearest stop from the festival's coordinates. This is not a mapping we verified on the ground.",
    noStation: 'No registered stop within 1 km of the festival grounds.',
    arrivalsEmpty: 'No bus is approaching this stop right now.',
    arrivalsError: "Couldn't load arrival information.",
    loading: 'Loading festivals…',

    source: 'Korea Tourism Organization festival & event data',
  },

  spot: {
    notFound: "We couldn't find that place",
    title: (name: string) => `${name} · Andong Itda`,
    back: '← Explore',
    rankLine: (rank: number) => `#${rank} most visited`,

    aboutHead: 'About this place',
    accessHead: 'Getting there',
    getOffBefore: 'Get off at ',
    rideAnd: ' takes you there — get off at ',
    fromDowntown: (stops: number, distance: string) =>
      `${stops} ${stops === 1 ? 'stop' : 'stops'} from downtown, ${distance}.`,
    getOffAfter: '.',
    schedule: (from: string, first: string, last: string) =>
      `From ${from}, the first bus is ${first} and the last is ${last}.`,
    returnUnknownLead: 'The official timetable has no return times for this route.',
    returnUnknownStrong: 'Check the return bus as soon as you arrive.',
    busPendingBody:
      "We haven't confirmed the bus stop for this place yet. We leave it blank rather than guess.",
    busNoneBody:
      'No bus information is registered here. We currently cover 7 of the most visited places.',
    directions: 'Directions in KakaoMap',

    aroundHead: 'Nearby places',

    panelPendingTitle: 'Bus info coming',
    panelPendingBody:
      "We're still confirming the stop. We don't fill in stops we haven't verified.",
    panelNoneBody: 'We currently show bus information for 7 of the most visited places.',
    mapCaption: (name: string) => `Around ${name}`,
  },

  spotRoutes: {
    head: 'Buses that come here',
    inboundHead: 'From downtown',
    outboundHead: 'Back to downtown',
    routeLabel: (routeNum: string) => `Bus ${routeNum}`,
    getOff: (station: string) => `Get off at ${station}`,
    ride: (stops: number, distance: string) =>
      `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${distance}`,
    thenWalk: (distance: string) => `then ${distance} on foot`,
    running: 'Running now',
    idleRoute: 'No buses on this route now',
    offHours: 'Buses are not running at this hour',
    more: (count: number) => `+${count} more ${count === 1 ? 'route' : 'routes'}`,

    disconnectedTitle: 'No single bus goes there',
    disconnectedBody:
      'There are stops nearby, but the routes serving them do not connect to downtown. You would need to transfer.',
    noneTitle: 'No stop within walking distance',
    noneBody: 'There is no registered bus stop close enough to walk from this place.',

    note: 'We worked this out from route data and the stops nearest the place. It is not a mapping we verified by hand.',
  },

  bus: {
    loading: 'Loading arrivals…',
    directionsToStop: 'Directions to this stop',
    stationUnknown: 'Stop not confirmed',
    inboundFromDowntown: 'Inbound from the city center',
    downtown: 'the city center',

    arrivingSoon: (routeNum: string) => `Bus ${routeNum} is arriving soon`,
    onTheWay: (routeNum: string) => `Bus ${routeNum} is on the way`,
    takesYouTo: (places: string) => `This one takes you to ${places}`,
    nextSameRoute: (routeNum: string, minutes: number) =>
      `The next bus ${routeNum} is in ${minutes} min`,

    after: 'away',
    locating: 'Locating bus',
    noInfo: 'No information',

    terminusTitle: 'This platform never shows arrivals',
    terminusBody1:
      "Buses start or end their run here, so there is no such thing as an 'approaching' bus.",
    terminusBody2: 'Pick another platform below.',
    emptyTitle: 'No bus is approaching this stop right now',
    emptyBody1: 'The interval may just be long, or service may be over for today.',
    emptyBody2: 'Try another stop.',

    waitingTitle: 'No bus approaching yet',
    waitingBody: 'The route is running. The interval is long, so one will come if you wait.',
    offHoursTitle: 'Buses are not running at this hour',
    offHoursBody: 'Check the first departure in the timetable below.',

    routeIdleTitle: 'No buses on this route right now',
    routeIdleBody:
      'Other routes are running. Check the timetable below for departure times.',

    departsFrom: (from: string) => `Departs ${from}`,
    firstLast: (first: string, last: string) => `First ${first} · Last ${last}`,
    runsPerDay: 'Runs per day',
    runsCount: (runs: number) => `${runs}`,
    returnTrip: 'Return',
    returnUnknownStrong: 'Return times are not in the official timetable.',
    returnUnknownFallback: 'Ask the driver for the last departure when you get there.',
  },

  realtime: {
    live: 'Live',
    refresh: 'Refresh arrivals',
    justNow: 'just now',
    minutesAgo: (minutes: number) => `${minutes} min ago`,
    hoursAgo: (hours: number) => `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`,
  },

  card: {
    rankBadge: (rank: number) => `#${rank}`,
    busRideMinutes: (minutes: number) => `about ${minutes} min by bus`,
    noPhoto: 'No photo yet',
  },

  map: {
    reset: 'Reset view',
    failed: "Couldn't load the map",
    pending: 'Map coming soon',
  },

  location: {
    origin: 'Andong Station',
    current: 'your location',
    unsupported: "This browser can't share your location",
    outside: "You seem to be outside Andong, so we're using Andong Station as the reference",
    denied: "We couldn't get your location, so we're using Andong Station as the reference",
  },

  distance: {
    rightHere: 'right here',
  },

  about: {
    title: 'About · Andong Itda',
    heading: 'About',
    sub: 'The data behind this service, and a few things worth knowing',

    sourcesHead: 'Data sources',
    sourceSpotsTerm: 'Place information · photos · popularity ranking',
    sourceSpotsDesc: 'Korea Tourism Organization TourAPI (KOGL)',
    sourceFestivalTerm: 'Festival & event dates',
    sourceFestivalDesc:
      'Korea Tourism Organization TourAPI (KOGL) · we only show festivals that are on now or start within 30 days',
    sourceWalkTerm: 'Walking routes',
    sourceWalkDesc: 'Put together by us (no Andong walking trails exist in public data)',
    sourceBusTerm: 'Stops · routes · live arrivals',
    sourceBusDesc: 'Andong City Bus Information System',
    sourceTimetableTerm: 'City bus timetables',
    sourceTimetableDesc: 'Andong City open data',
    sourcesNote:
      'Rights to each work belong to the issuing organization. The popularity ranking comes straight from Korea Tourism Organization visit data — we do not rank anything ourselves.',

    limitsHead: 'Limits of the bus information',
    limitsRealtime:
      "Arrival times are the Andong City Bus Information System's live data, shown as-is. Conditions on the ground can differ.",
    limitsScheduleLead: 'First and last departures come from timetables published by Andong City.',
    limitsScheduleStrong: 'Some routes have no return times in the official timetable.',
    limitsScheduleTail:
      'For those routes we say so on screen rather than guess at a time. Please confirm the return bus in person once you arrive.',
    limitsMissed:
      'On many routes, missing a bus means a long wait for the next one. If your trip is time-sensitive, confirm once more with Andong City transport or on-site information.',

    locationHead: 'Location',
    locationIntro:
      "If you allow location on the 'Right Now' screen, we use the coordinates your browser reports to find nearby stops and places within walking distance.",
    locationPoint1Lead: 'Your coordinates ',
    locationPoint1Strong: 'never reach our server.',
    locationPoint1Tail: ' Even the math that picks the nearest stop runs inside your browser',
    locationPoint2:
      'We do not store your coordinates. There is no database, and they are gone when you leave the page',
    locationPoint3:
      'If you decline, everything still works — Andong Station is used as the reference point',
    locationCaveatLead: 'Two things worth stating plainly.',
    locationCaveat1:
      'Maps are drawn with KakaoMap. Displaying a map means your browser requests map tiles from Kakao servers',
    locationCaveat2:
      'To fetch bus arrivals we do have to say which stop. We query by stop number only, and no coordinates go with that request',

    privacyHead: 'Privacy',
    privacy1:
      'There is no sign-up and no login. We collect nothing that identifies you — no name, contact, or payment details — and there is no database to hold them.',
    privacy2:
      'Access logs that exist simply because you opened the site are handled automatically by our hosting provider. We do not inspect them or use them for anything else.',

    sourceHead: 'How this was built',
    sourceBody:
      "A lot of the judgement here never shows on screen — why a stop gets pushed down the list, why we leave a last-bus time blank when we do not know it. Those decisions are written down: 38 records.",
    sourceLink: 'Source code and decision records (GitHub)',

    closing:
      'Andong Itda is an entry in the Korea Tourism Organization 2026 Tourism Data Contest. We built it for people traveling Andong without a car.',
  },
}

export const MESSAGES: Record<Locale, Messages> = { ko, en }

/**
 * 관광지 분류 — LocgoHub `hubCtgryMclsNm`의 영문
 *
 * 상류가 주는 자유 문자열이라 **닫힌 집합이 아니다.** 실측(2026-08-16) 54건에
 * 실제로 나온 값은 일곱이다: 문화관광 21 · 역사관광 17 · 레저스포츠 5 ·
 * 기타관광 4 · 쇼핑 3 · 자연관광 2 · 체험관광 2.
 *
 * 나머지는 이 데이터셋의 다른 시군에서 관측되는 값을 미리 넣어 뒀다.
 * 그래도 없는 값이 오면 **국문을 그대로 보여준다.** 영어로 지어내지 않는다 —
 * 분류를 잘못 옮기면 칩이 거짓말을 하고, 그건 빈칸보다 나쁘다.
 */
const SPOT_CATEGORY_EN: Record<string, string> = {
  문화관광: 'Culture',
  역사관광: 'History',
  자연관광: 'Nature',
  체험관광: 'Experiences',
  레저스포츠: 'Sports & Leisure',
  휴양관광: 'Rest & Retreat',
  쇼핑: 'Shopping',
  음식: 'Food',
  숙박: 'Stays',
  기타관광: 'Other',
}

/**
 * 음식 분류 — 우리가 정의한 닫힌 집합이라 전부 옮길 수 있다 (→ ADR-023)
 *
 * 찜닭·헛제삿밥은 번역하지 않고 로마자로 적는다. 여행자가 현장에서 마주치는
 * 간판과 메뉴판이 그 이름이고, "Braised Chicken"으로 옮겨 두면 정작 가게 앞에서
 * 못 알아본다. 안동에 오는 이유이기도 한 음식이다.
 */
const FOOD_CATEGORY_EN: Record<string, string> = {
  찜닭: 'Jjimdak',
  헛제삿밥: 'Heotjesatbap',
  한식: 'Korean',
  카페: 'Cafés',
}

/** 분류 한 건의 표시명. 모르는 값은 국문 그대로 — 지어내지 않는다. */
export function categoryLabel(category: string, locale: Locale): string {
  if (locale === 'ko') return category
  return FOOD_CATEGORY_EN[category] ?? SPOT_CATEGORY_EN[category] ?? category
}
