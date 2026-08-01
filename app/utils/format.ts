/**
 * 화면 표시용 포맷
 *
 * 여기 있는 함수는 전부 "숫자를 사람 말로" 바꾸는 일만 한다.
 * 판단(운행 중인가, 막차가 지났는가)은 서버가 이미 끝냈으므로 여기서 다시 하지 않는다.
 */

/**
 * 1km 미만은 m, 이상은 소수 첫째 자리 km
 *
 * 30m 미만은 "바로 앞"이다. 위치 폴백을 쓰면 기준점이 정류장 좌표와 정확히
 * 겹쳐 "0m"가 나오는데, 그건 거리가 아니라 계산 결과가 새어 나온 것처럼 보인다.
 */
export function formatDistance(meters: number): string {
  if (meters < 30) return '바로 앞'
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

/**
 * 주소에서 읍·면·동만 남긴다.
 *
 * "경상북도 안동시 풍천면 전서로 186" → "풍천면"
 * 카드 한 줄에 전체 주소를 넣으면 잘리기만 하고 위치감은 주지 못한다.
 */
export function shortAddress(address: string): string {
  const token = address
    .split(/\s+/)
    .find((part) => /[읍면동]$/.test(part) || /[읍면동]\d?$/.test(part))

  // 읍·면·동이 없는 주소(도로명만 있는 경우)는 시 다음 토큰을 쓴다.
  return token ?? address.split(/\s+/)[2] ?? address
}

/**
 * 도착 예정 표기
 *
 * predictTm은 null로 올 수 있다(차량 위치 미확보). 그때 0분으로 표시하면
 * 화면이 거짓말을 한다. 남은 정류장 수로 대체하고, 그것도 없으면 정보 없음이다.
 * → ADR-006
 */
export function formatArrival(predictTm: number | null, remainStation: number | null): string {
  if (predictTm !== null) return `${predictTm}분 후`
  if (remainStation !== null) return `${remainStation}정거장 전`
  return '정보 없음'
}

/**
 * "교보생명 -> 하회마을"을 방향 문구로 바꾼다.
 *
 * via는 명세서에 없지만 실제로 오는 필드이고, 여행자가 정류장에서 가장 헷갈리는
 * "이게 내가 가려는 방향인가"에 답하는 정보다. 종점만 남겨 짧게 보여준다.
 */
export function formatDirection(via: string): string {
  const destination = via.split('->').pop()?.trim()
  return destination ? `${destination} 방면` : via
}
