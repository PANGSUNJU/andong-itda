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
