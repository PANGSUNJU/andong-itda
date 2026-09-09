/**
 * 기준 위치
 *
 * 위치 권한을 거부했거나 안동 밖에 있는 사용자에게도 화면은 채워져야 한다.
 * 그때 쓰는 대체 원점이다. → ADR-012
 */

/**
 * 안동역(안동터미널) — 정류장 354000536의 실제 좌표.
 *
 * 구 안동역(운흥동, 354000063)이 아니라 2020년 이전한 송현동 역이다.
 * 정류장 목록에 "구 안동역"과 "안동역(안동터미널)"이 함께 있으므로
 * 이름으로 찾으면 엉뚱한 쪽을 집는다. 좌표를 상수로 박아둔다.
 */
export const ANDONG_ORIGIN = {
  name: '안동역',
  lat: 36.57349,
  lng: 128.67566,
} as const

/**
 * 안동시 대략 경계 — 이 밖의 좌표는 ANDONG_ORIGIN으로 되돌린다.
 *
 * 서울에서 접속한 사용자에게 "가장 가까운 정류장 78km"를 보여주는 것보다
 * 안동역 기준 화면을 보여주는 편이 낫다. 이 서비스는 안동 안에서만 쓸모가 있다.
 */
export const ANDONG_BOUNDS = {
  minLat: 36.3,
  maxLat: 36.85,
  minLng: 128.3,
  maxLng: 129.15,
} as const

export function isInAndong(lat: number, lng: number): boolean {
  return (
    lat >= ANDONG_BOUNDS.minLat &&
    lat <= ANDONG_BOUNDS.maxLat &&
    lng >= ANDONG_BOUNDS.minLng &&
    lng <= ANDONG_BOUNDS.maxLng
  )
}

/**
 * 도보 시간 추정 — 분속 67m(시속 4km)
 *
 * 직선거리를 그대로 나눈 값이라 실제 도보 시간보다 짧게 나온다.
 * 화면에서 "약"을 붙여 추정치임을 드러낸다. 실제 도보 경로 계산은 미해결 과제다.
 */
export const WALK_METERS_PER_MINUTE = 67

export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE))
}

/**
 * 버스 소요 시간 추정 — 직선거리 분속 267m(시속 16km)
 *
 * "4.4km"는 그 자리에 서 있는 사람이 쓸 수 없는 숫자다. 걸어갈지 탈지는 이미
 * 정해졌고(2km 밖이다), 남은 질문은 "타면 얼마나 걸리나"뿐이다.
 *
 * ⚠️ 도로 거리가 아니라 **직선거리**를 나눈다. 자의적인 상수가 아니라
 *    실제 노선 두 건의 시간표와 노선 길이로 역산한 값이다(실측 2026-09-09).
 *
 *      210(교보생명→하회마을)  노선 25,611m / 직선 19,038m  06:30→07:35 = 65분 → 직선 17.6km/h
 *      310(교보생명→봉정사)    노선 16,174m / 직선 11,273m  06:10→06:55 = 45분 → 직선 15.0km/h
 *
 *    둘 사이를 잡아 16km/h로 둔다. 역으로 검산하면 하회 71분(실제 65), 봉정사 42분(실제 45)이다.
 *    노선 우회(직선 대비 1.35~1.43배)와 정차 시간이 이 하나의 상수에 함께 들어 있다.
 *
 * ⚠️ **기다리는 시간은 빠져 있다.** 탄 뒤에 걸리는 시간이다. 안동 외곽 노선은
 *    배차가 하루 3~13회라 대기가 이동보다 길 수 있다. 화면은 이 숫자 옆에
 *    도착정보와 시간표를 함께 놓아야 하고, 이 값만 단독으로 쓰면 안 된다.
 */
export const BUS_METERS_PER_MINUTE = 267

/**
 * 5분 단위로 끊는다. 시속 16km 추정치에서 "17분"은 없는 정밀도를 주장하는 것이고,
 * "약 20분"은 추정임이 표기에서 드러난다. 도보(`walkMinutes`)를 1분 단위로 두는 것은
 * 2km 안쪽이라 오차의 절대값이 작기 때문이고, 여기는 그렇지 않다.
 */
export function busMinutes(meters: number): number {
  const minutes = meters / BUS_METERS_PER_MINUTE
  return Math.max(5, Math.round(minutes / 5) * 5)
}

/** 두 좌표 사이 직선거리(m). 하버사인. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 거리와 도보 시간이 채워진 항목 */
export type WithDistance<T> = T & { distance: number; walkMinutes: number }

/**
 * 가까운 순으로 고르기 — 브라우저에서 돈다
 *
 * 이 함수가 서버가 아니라 shared에 있는 이유는 위치정보법이다.
 * 사용자 좌표를 서버로 보내면 사업자가 위치정보를 '수집'한 것이 되고
 * (쿼리스트링은 배포 로그에도 남는다) 위치기반서비스사업 신고 쟁점이 생긴다.
 * 좌표를 브라우저 밖으로 내보내지 않으려면 계산도 브라우저에 있어야 한다. → ADR-024
 *
 * 원본 배열을 건드리지 않는다. 홈은 같은 관광지 목록을
 * 순위순(인기 목록)과 거리순(주변 목록)으로 동시에 쓴다.
 */
export function nearest<T extends { lat: number; lng: number }>(
  items: T[],
  from: { lat: number; lng: number },
  { radius = Infinity, limit = Infinity }: { radius?: number; limit?: number } = {},
): WithDistance<T>[] {
  return items
    .map((item) => {
      const distance = Math.round(distanceMeters(from.lat, from.lng, item.lat, item.lng))
      return { ...item, distance, walkMinutes: walkMinutes(distance) }
    })
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
}
