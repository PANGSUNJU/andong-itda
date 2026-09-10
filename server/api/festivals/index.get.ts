import type { Festival, FestivalStatus, KorFestivalWithEnglish } from '#shared/types/tour'

import { isVisibleFestival, judgeFestival, kstToday } from '#shared/constants/festival'

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
   * ⚠️ 예전에는 여기서 정류장 목록(2107건)까지 함께 받아 축제장 근처 승강장을
   *    계산했다. 그 계산을 걷어냈다(→ ADR-041). 이 응답은 이제 축제만 말한다.
   */
  const raw = await cachedFestivals()
  const today = kstToday()
  const visible: Festival[] = []

  for (const festival of raw) {
    const judgement = judgeFestival(festival.eventstartdate, festival.eventenddate, today)
    if (!isVisibleFestival(judgement)) continue

    visible.push(toFestival(festival, judgement))
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

/** 상류 한 건 + 오늘의 판정 → 화면용 축제 */
function toFestival(
  kor: KorFestivalWithEnglish,
  judgement: { status: FestivalStatus; daysUntilStart: number; daysUntilEnd: number },
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
  }
}
