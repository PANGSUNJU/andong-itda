/**
 * 축제 진행 여부 판정 — 이 서비스에서 유일하게 날짜에 의존하는 데이터
 *
 * **상류가 진행 상태를 주지 않는다.** 응답에 `progresstype`·`festivaltype`이
 * 있어서 이름만 보면 줄 것 같지만, 실측(2026-09-01) 7건의 값은 `progresstype`이
 * "선택안함" 아니면 빈 문자열이고 `festivaltype`은 전부 빈 값이다.
 * 진행 여부는 우리가 `eventstartdate`·`eventenddate`로 판정해야 한다.
 *
 * 판정을 캐시에 굽지 않는다. 목록은 1일 캐시하지만 상태는 요청 시점에 만든다.
 * 관광지처럼 결과까지 캐시하면 자정을 넘겨 "지금 열립니다"가 하루 틀어진다.
 * 축제에서 하루는 전부다 — 탈춤페스티벌은 11일짜리다.
 */

/**
 * "예정"으로 보여줄 창(일)
 *
 * 진행중만 보여주면 대부분의 날에 화면이 빈다. 실측(2026-09-01): 진행중 0건,
 * 예정 3건, 종료 4건. 여행 계획을 세우는 사람에게 "3주 뒤에 탈춤페스티벌이
 * 열린다"는 지금 열리는 것만큼 쓸모 있는 정보이기도 하다.
 *
 * 30일보다 넓히지 않는다. 넉 달 뒤 축제까지 띄우면 이 아이콘이 상시 노출되고,
 * "지금 뭔가 열린다"는 신호가 아니라 그냥 또 하나의 메뉴가 된다.
 */
export const UPCOMING_WINDOW_DAYS = 30

/** 하루(ms) */
const DAY_MS = 86_400_000

/** 한국 표준시 오프셋(ms). 안동시 축제의 날짜는 KST 달력으로 적힌 값이다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 한국 표준시 기준 오늘 — 'YYYYMMDD'
 *
 * ⚠️ `new Date().toISOString()`을 그대로 쓰면 안 된다. 배포 환경(서버리스)의
 *    시스템 시각은 UTC라, KST로 9월 24일 오전 0시 30분이 UTC로는 아직 9월 23일이다.
 *    탈춤페스티벌이 시작하는 그 순간에 "D-1"이라고 적히는 오차가 바로 여기서 난다.
 *
 * UTC 밀리초에 9시간을 더한 뒤 UTC로 읽으면 KST 달력 날짜가 나온다.
 * 로컬 타임존에 의존하지 않으므로 개발 기기(KST)와 배포(UTC)가 같은 답을 낸다.
 */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '')
}

/**
 * 'YYYYMMDD' → 그 날 자정(UTC)의 밀리초
 *
 * 시각을 버리고 날짜만 남긴다. 두 날짜의 차이를 날 수로 셀 때 시:분이 섞이면
 * "D-1"과 "D-0"이 시각에 따라 흔들린다. 축제는 날 단위로 열리고 닫힌다.
 */
export function ymdToTime(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)))
}

/** from에서 to까지 며칠인가. 같은 날이면 0, 내일이면 1. */
export function daysBetween(from: string, to: string): number {
  return Math.round((ymdToTime(to) - ymdToTime(from)) / DAY_MS)
}

export interface FestivalJudgement {
  status: 'ongoing' | 'upcoming' | 'ended'
  /** 시작까지 남은 날. 진행중·종료는 0 이하가 된다. */
  daysUntilStart: number
  /** 마지막 날까지 남은 날. 마지막 날이면 0. */
  daysUntilEnd: number
}

/**
 * 오늘이 이 축제의 어디쯤인가
 *
 * 시작일과 종료일을 **양끝 포함**으로 본다. 상류의 `eventenddate`는 "이 날까지
 * 한다"는 뜻이라, 마지막 날 아침에 종료로 넘기면 그날 축제장에 가려는 사람에게
 * 없는 축제가 된다.
 *
 * 날짜 문자열이 8자리 숫자가 아니면 `ended`로 본다. 모르는 형식을 진행중으로
 * 잘못 보면 없는 축제를 "지금 열립니다"로 띄우게 된다. 없는 쪽으로 틀리는 게 낫다.
 */
export function judgeFestival(
  startDate: string,
  endDate: string,
  today: string,
): FestivalJudgement {
  const valid = (ymd: string) => /^\d{8}$/.test(ymd)
  if (!valid(startDate) || !valid(endDate)) {
    return { status: 'ended', daysUntilStart: 0, daysUntilEnd: 0 }
  }

  const daysUntilStart = daysBetween(today, startDate)
  const daysUntilEnd = daysBetween(today, endDate)

  const status = daysUntilEnd < 0 ? 'ended' : daysUntilStart <= 0 ? 'ongoing' : 'upcoming'

  return { status, daysUntilStart, daysUntilEnd }
}

/**
 * 화면에 띄울 축제인가 — 진행중이거나, 곧 시작하거나
 *
 * 종료된 축제는 뺀다. 지난 축제를 "종료"라고 계속 띄우면 이 아이콘이 달력이
 * 되어 버린다. 이건 "지금 안동에서 무슨 일이 있는가"에 답하는 자리다.
 */
export function isVisibleFestival(
  judgement: FestivalJudgement,
): judgement is FestivalJudgement & { status: 'ongoing' | 'upcoming' } {
  if (judgement.status === 'ongoing') return true
  return judgement.status === 'upcoming' && judgement.daysUntilStart <= UPCOMING_WINDOW_DAYS
}

/**
 * 조회 시작일 — `searchFestival2`의 필수 파라미터 `eventStartDate`
 *
 * ⚠️ 이 파라미터는 "그 기간에 **열리는**"이 아니라 "그 기간에 **시작하는**"이다.
 *    `eventStartDate=오늘`로 주면 진행 중인 탈춤페스티벌조차 안 나온다(실측 0건).
 *    넓게 받아서 우리가 거르는 것이 유일하게 맞는 방식이다.
 *
 * 작년 1월 1일부터 받는다. 해를 넘겨 이어지는 상설공연(실측: 하회별신굿탈놀이
 * 상설공연이 20250101~20251231 한 건으로 등재돼 있다)까지 잡으려면 올해 1월 1일로는
 * 부족하다. 안동 축제가 7건이라 범위를 넓혀도 응답이 커지지 않는다.
 *
 * 끝을 주지 않는다. 내년 축제가 등재되면 그날부터 자동으로 잡힌다.
 */
export function festivalQueryStartDate(today: string = kstToday()): string {
  return `${Number(today.slice(0, 4)) - 1}0101`
}
