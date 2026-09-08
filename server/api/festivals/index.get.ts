import type { StationPin } from '#shared/types/bus'
import type {
  Festival,
  FestivalStation,
  FestivalStatus,
  KorFestivalWithEnglish,
} from '#shared/types/tour'

import { isVisibleFestival, judgeFestival, kstToday } from '#shared/constants/festival'
import { nearest } from '#shared/constants/location'

/**
 * 지금 열리거나 곧 열리는 안동 축제 — 다섯 번째 관광공사 API
 *
 * ADR-010이 "안동에 축제 데이터가 0건"이라며 연동을 제외했다. 그 0건은 옛 지역
 * 코드로 조회한 결과였고, 법정동 코드로는 7건이 온다. ADR-034가 관광지에서
 * 바로잡은 것과 같은 오진의 다른 얼굴이다. → ADR-035
 *
 * ⚠️ **캐시하는 것과 하지 않는 것이 갈린다.**
 *
 *    캐시  원본 목록(`fetchFestivals`) — 1일. 축제 등재는 월 단위로도 안 바뀐다
 *    안 함 진행/예정 판정 — 요청 시점. 날짜가 바뀌면 답이 바뀌어야 한다
 *
 *    이 서비스에서 날짜에 의존하는 데이터는 축제뿐이다. 관광지처럼 결과까지
 *    통째로 캐시하면 자정을 넘겨 "지금 열립니다"가 **하루 틀어진다.** 축제에서
 *    하루는 작지 않다 — 안아드림 페스티벌은 이틀짜리라 하루가 절반이다.
 *
 * 종료된 축제는 빼고, 예정은 30일 창 안쪽만 남긴다. → UPCOMING_WINDOW_DAYS
 * 실측(2026-09-01): 7건 중 2건이 남는다(K-스토리 D-16, 탈춤페스티벌 D-23).
 */
const cachedFestivals = defineCachedFunction(
  async (): Promise<KorFestivalWithEnglish[]> => fetchFestivals(),
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'festivals',
    getKey: () => 'all',
  },
)

export default defineEventHandler(async (): Promise<Festival[]> => {
  /**
   * 정류장 목록은 우리 라우트를 통해 받는다. 원격을 직접 부르면 그 1일 캐시를
   * 버리고 매 요청마다 2107건을 다시 받는다. 관광지 상세가 같은 이유로 같은 선택을 한다.
   */
  const [raw, stations] = await Promise.all([
    cachedFestivals(),
    $fetch<StationPin[]>('/api/bus/stations'),
  ])

  const today = kstToday()
  const visible: Festival[] = []

  for (const festival of raw) {
    const judgement = judgeFestival(festival.eventstartdate, festival.eventenddate, today)
    if (!isVisibleFestival(judgement)) continue

    visible.push(toFestival(festival, judgement, stations))
  }

  /**
   * 진행중이 먼저, 그다음 곧 시작하는 순.
   *
   * 시작일순으로만 세우면 어제 시작해 다음 주까지 하는 축제가 내일 시작하는
   * 축제보다 뒤로 간다. 지금 갈 수 있는 곳이 맨 위여야 한다.
   */
  return visible.sort(
    (a, b) =>
      Number(b.status === 'ongoing') - Number(a.status === 'ongoing') ||
      a.startDate.localeCompare(b.startDate),
  )
})

/**
 * 축제장에서 이만큼 안쪽의 정류장만 "가까운 정류장"이라 부른다(m)
 *
 * 실측(2026-09-01) 7건의 최근접 정류장이 97m~295m였다. 1km는 그 실측에 대한
 * 넉넉한 여유이지 기대치가 아니다. 산속에서 열리는 축제가 등재되면 정류장이
 * 하나도 안 잡히는 편이 맞다 — 2km 떨어진 정류장을 "가까운 정류장"으로 부르면
 * 그 버스를 타고 간 사람이 길에 남는다.
 */
const STATION_RADIUS_M = 1000

/**
 * 보여줄 승강장 수
 *
 * 하나로는 부족하다. 실측에서 탈춤페스티벌의 1·2위가 '탈춤공원건너'(97m)와
 * '탈춤공원앞'(98m)이었다. 1m 차이의 **반대 방향 승강장**이고, 가장 가까운 쪽이
 * 내가 갈 방향이라는 보장은 없다. 홈이 같은 이유로 승강장을 고르게 한다.
 */
const STATION_LIMIT = 3

/**
 * 축제 좌표에서 가까운 정류장 — 손으로 매핑하지 않는다
 *
 * 관광지는 `spot-station-map.json`에 사람이 확인한 매핑을 둔다. 축제에는 그
 * 방식을 쓸 수 없다. 매년 바뀌고 새로 생기는데 손으로 확인한 매핑은 그 속도를
 * 못 따라가고, 못 따라간 해에는 화면이 조용히 비거나 작년 정류장을 가리킨다.
 *
 * 대신 좌표에서 계산하고 **계산해서 구했다는 사실을 화면에 적는다**(→ i18n
 * `festival.stationNote`). 근거를 숨기고 정확한 척하지 않는 것이 이 서비스의 규칙이다.
 *
 * 도착정보가 원리적으로 오지 않는 기·종점 승강장은 뒤로 민다. 지우지는 않는다 —
 * 실재하는 승강장이고, 거기 선 사람에게는 "여기는 안 뜬다"가 답이다. → ADR-015
 */
function nearbyStations(lat: number, lng: number, stations: StationPin[]): FestivalStation[] {
  const near = nearest(stations, { lat, lng }, { radius: STATION_RADIUS_M })

  return [...near.filter((s) => !s.terminusOnly), ...near.filter((s) => s.terminusOnly)]
    .slice(0, STATION_LIMIT)
    .map((station) => ({
      stationId: station.stationId,
      stationNm: station.stationNm,
      // 상류가 2107곳 전부 채워 준다. 영문 화면에서 가장 값이 큰 한 줄이다. → ADR-030
      ...(station.nameEn ? { nameEn: station.nameEn } : {}),
      // 같은 이름(그리고 같은 영문명)의 승강장을 가르는 유일한 정보다.
      ...(station.direction ? { direction: station.direction } : {}),
      distance: station.distance,
      walkMinutes: station.walkMinutes,
      ...(station.terminusOnly ? { terminusOnly: true } : {}),
    }))
}

/** 상류 한 건 + 오늘의 판정 → 화면용 축제 */
function toFestival(
  kor: KorFestivalWithEnglish,
  judgement: { status: FestivalStatus; daysUntilStart: number; daysUntilEnd: number },
  stations: StationPin[],
): Festival {
  const lat = Number(kor.mapy)
  const lng = Number(kor.mapx)

  return {
    id: kor.contentid,
    name: kor.title,
    // 없으면 필드를 넣지 않는다. 빈 문자열을 넣으면 화면이 부재와 빈 값을 구분 못 한다.
    ...(kor.nameEn ? { nameEn: kor.nameEn } : {}),
    startDate: kor.eventstartdate,
    endDate: kor.eventenddate,
    status: judgement.status,
    daysUntilStart: judgement.daysUntilStart,
    daysUntilEnd: judgement.daysUntilEnd,
    lat,
    lng,
    ...(kor.addr1 ? { address: kor.addr1 } : {}),
    // 실측 7/7이 이미지를 갖고 있지만 그건 오늘의 사실이지 보장이 아니다.
    ...(kor.firstimage ? { imageUrl: httpsImage(kor.firstimage) } : {}),
    contentId: kor.contentid,
    stations: nearbyStations(lat, lng, stations),
  }
}
