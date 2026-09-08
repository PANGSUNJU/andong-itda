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
  /**
   * 영문 이름 — EngService2에서 붙인다. **대부분 없다.**
   *
   * 실측(2026-08-19): 관광지 17/54, 음식점 2/15. 세 번 찾은 결과다 —
   * 지역 조회는 `areacode`가 빈 레코드를 놓쳐 하회마을·월영교가 빠진다. → ADR-033
   *
   * 없으면 국문 이름이 그대로 나간다. 지어내지 않는다(→ ADR-030).
   * 영문 화면에서 국문이 남는 것은 결함이 아니라 상류의 사실이다.
   */
  nameEn?: string
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

/**
 * 음식점 분류 — 닫힌 집합이다
 *
 * 앞의 둘은 이름에서 읽어낸 것이고, 뒤의 둘은 API의 cat3를 옮긴 것이다.
 * 간고등어(옥야식당·일직식당)가 없는 이유는 그 사실이 응답 어디에도 없기 때문이다.
 * 여기 있는 값은 전부 응답만 보고 다시 만들 수 있다. → ADR-023
 */
export type FoodCategory = '찜닭' | '헛제삿밥' | '한식' | '카페'

/**
 * 음식점
 *
 * 필드는 Spot과 같다. 다른 것은 category를 만드는 방법과 rank의 유무다.
 *   Spot      category는 상류(LocgoHub hubCtgryMclsNm)가 주는 자유 문자열이고
 *             rank는 방문 기반 순위다
 *   FoodPlace category는 우리가 만드는 닫힌 집합이고 rank는 항상 null이다
 *             (음식점은 LocgoHub에 없어서 순위 자체가 없다)
 *
 * ⚠️ tel 필드를 두지 않는다. areaBasedList2는 전화번호를 주지 않아서
 *    16건 전부 빈 값이다. 채우려면 detailCommon2가 필요한데 아직 미검증이다.
 *    필드를 만들어 두면 화면이 전화 버튼을 붙이고 16곳 전부 빈 버튼이 된다. → ADR-011
 */
export interface FoodPlace extends Spot {
  category: FoodCategory
  rank: null
}

/**
 * 영문 관광정보 한 건 — `EngService2/areaBasedList2`
 *
 * ⚠️ **국문과 분류 코드가 다르다.** `contentTypeId=12`(관광지)로 조회하면 0건이고,
 *    안동 32건의 코드는 75·76·78·80·82·85 대역이다. 그래서 타입을 지정하지 않고
 *    시군구로만 조회한다.
 *
 * ⚠️ 연결 고리는 좌표가 아니라 **제목 괄호 안의 국문명**이다.
 *    `"Andong Folk Village (안동민속촌)"` → `안동민속촌`
 *    32건 전부 이 꼴로 오는 것을 확인했다. 좌표(mapx/mapy)는 국문 데이터와
 *    대표 지점이 달라 하회마을처럼 1.5km씩 벌어지는 경우가 있다(ADR-021).
 */
export interface EngSpot {
  contentid: string
  /** "Andong Folk Village (안동민속촌)" */
  title: string
  /**
   * 영문 주소. **동명이소를 거르는 유일한 수단이다.**
   *
   * `searchKeyword2`가 전국을 뒤지므로 "시립박물관"이 강릉 오죽헌을 물어 온다.
   * 좌표는 못 쓴다 — 두 데이터셋의 대표 좌표가 하회마을에서만 1,580m 벌어진다(ADR-021).
   * 실측: 안동 영문 레코드 32건 전부 `Andong-si`가 들어 있다.
   */
  addr1?: string
  mapx: string
  mapy: string
  firstimage?: string
}

/**
 * 축제 한 건 — `KorService2/searchFestival2`
 *
 * 필드는 관광지(KorSpot)와 같은 꼴에 날짜 넷이 더 붙는다.
 * `areaBasedList2`가 아니라 전용 엔드포인트를 쓰는 이유는 **날짜 때문**이다.
 * `searchKeyword2`로 축제를 잡으면 4건이 나오지만 `eventstartdate`가 아예 없어서
 * 진행 여부를 판정할 수단이 없다. → ADR-035
 *
 * ⚠️ 7건 전부 `areacode`·`sigungucode`가 **빈 값**이다. 관광지와 정확히 같은
 *    결함이라, 옛 지역 코드로 조회하면 0건이 온다. 그 0건이 ADR-010의 근거였다.
 *    법정동 코드로 조회해야 한다. → KOR_SERVICE_LDONG_REGION
 */
export interface KorFestival extends KorSpot {
  /** 'YYYYMMDD'. 시작일. */
  eventstartdate: string
  /** 'YYYYMMDD'. **이 날까지 한다**는 뜻이라 판정에서 양끝을 포함한다. */
  eventenddate: string
  /**
   * ⚠️ 진행 상태로 쓸 수 없다. 이름이 그렇게 읽히지만 실측(2026-09-01) 값은
   *    "선택안함" 아니면 빈 문자열이다. 진행 여부는 날짜로 판정한다.
   *    → shared/constants/festival.ts
   */
  progresstype?: string
  /** ⚠️ 실측 7건 전부 빈 값이다. 분류로 쓸 수 없다. */
  festivaltype?: string
}

/**
 * 영문 축제 한 건 — `EngService2/searchFestival2`
 *
 * ⚠️ 국문과 **contentid가 다르다.** 실측(2026-09-01): 탈춤페스티벌이 국문 506670,
 *    영문 697123이다. 관광지에서 확인한 것과 같은 사실이다 — 두 서비스는 ID 체계가
 *    별개다(ADR-033). 이을 고리는 제목 괄호 안의 국문명과 날짜다.
 *
 * ⚠️ 영문 목록이 국문 목록의 부분집합이 아니다. 실측 3건 중 '월영야행'과
 *    '하회별신굿탈놀이 상설공연'은 **영문에만 있다.** 그래도 영문 화면의 목록을
 *    영문 응답으로 만들지 않는다. 두 언어가 다른 축제를 보여주면 같은 서비스가
 *    아니게 된다. 영문 응답은 이름을 붙이는 데만 쓴다.
 */
export interface EngFestival extends EngSpot {
  eventstartdate: string
  eventenddate: string
}

/** 영문 이름까지 붙인 축제 원본. 캐시에 담기는 모양이고, 상태는 아직 없다. */
export interface KorFestivalWithEnglish extends KorFestival {
  nameEn?: string
}

/**
 * 축제 진행 상태 — 화면에 나가는 것은 이 둘뿐이다
 *
 * 종료된 축제는 목록에서 뺀다. 지난 축제를 계속 띄우면 "지금 안동에서 무슨 일이
 * 있는가"에 답하는 자리가 달력이 된다. → `isVisibleFestival`
 */
export type FestivalStatus = 'ongoing' | 'upcoming'

/**
 * 축제장에서 가장 가까운 정류장
 *
 * 관광지의 `spot-station-map.json`과 달리 손으로 매핑하지 않는다. 축제는 매년
 * 바뀌고 새로 생기는데, 사람이 확인한 매핑은 그 속도를 못 따라간다. 좌표에서
 * 계산하고 **그렇게 구했다는 사실을 화면에 적는다.**
 *
 * 실측(2026-09-01) 축제 7건 전부 최근접 정류장이 400m 이내였다. 탈춤페스티벌은
 * 97m('탈춤공원건너')다. 계산으로 뽑아도 쓸 만한 답이 나오는 조건이다.
 */
export interface FestivalStation {
  stationId: number
  stationNm: string
  nameEn?: string
  /**
   * 방면 — 노선상 다음 정류장의 이름
   *
   * ⚠️ 없으면 같은 이름의 승강장을 고를 수 없다. 실측(2026-09-01): 탈춤페스티벌의
   *    1·2위가 '탈춤공원건너'(97m)와 '탈춤공원앞'(98m)인데 **영문명이 둘 다
   *    'Talchum gong-won'으로 같다.** 거리도 1m 차이라 영문 화면에서는 두 칩이
   *    글자 그대로 구별되지 않는다. 방면이 유일하게 둘을 가르는 정보다.
   */
  direction?: string
  /** 축제장까지 직선거리(m) */
  distance: number
  walkMinutes: number
  /** 도착정보가 원리적으로 오지 않는 승강장. 뒤로 민다. → ADR-015 */
  terminusOnly?: boolean
}

/** 화면용 축제. 상태와 남은 날은 캐시하지 않고 요청 시점에 채운다. */
export interface Festival {
  /** contentid */
  id: string
  name: string
  /**
   * 영문 이름 — `EngService2/searchFestival2`에서 붙인다. 관광지와 같은 규칙으로
   * **있는 것에만** 붙고, 없으면 국문이 그대로 나간다. → ADR-030
   */
  nameEn?: string
  /** 'YYYYMMDD' */
  startDate: string
  endDate: string
  status: FestivalStatus
  /** 시작까지 남은 날. 진행중이면 0 이하다. */
  daysUntilStart: number
  /** 마지막 날까지 남은 날. 마지막 날이면 0. */
  daysUntilEnd: number
  lat: number
  lng: number
  address?: string
  imageUrl?: string
  contentId: string
  /**
   * 가까운 정류장. 가까운 순이되 도착정보가 안 뜨는 승강장은 뒤로 민다.
   *
   * 하나만 주지 않는다. 실측에서 탈춤페스티벌의 1·2위가 '탈춤공원건너'(97m)와
   * '탈춤공원앞'(99m)으로 **2m 차이의 반대 방향 승강장**이었다. 가장 가까운 쪽이
   * 내가 갈 방향이라는 보장이 없다. 홈이 같은 이유로 승강장을 고르게 한다.
   */
  stations: FestivalStation[]
}

/**
 * 관광사진 갤러리 한 건 — `PhotoGalleryService1/gallerySearchList1`
 *
 * 한국관광공사가 직접 수집한 사진이다. KorService2의 `firstimage`가 없을 때
 * 마지막으로 기대는 곳이다. **좌표가 없어서 이름으로만 맞출 수 있다.**
 *
 * ⚠️ `galWebImageUrl`이 **http로 온다.** 실측(2026-08-14): 1000건 중 883건.
 *    https 페이지에서 그대로 쓰면 Mixed Content로 차단된다. 같은 경로를 https로
 *    요청하면 동일한 이미지가 200(image/jpg, 223KB)으로 열리는 것을 확인했다.
 */
export interface GalleryPhoto {
  galContentId: string
  galTitle: string
  galWebImageUrl: string
  /** "경상북도 안동시 풍천면" 꼴. 동명이소를 거르는 유일한 단서다. */
  galPhotographyLocation: string
  /** 촬영자가 붙인 태그. 제목에 없는 이름이 여기 있다(하회마을 사진의 '부용대'). */
  galSearchKeyword: string
}
