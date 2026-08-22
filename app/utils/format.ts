// #shared/~ 별칭이 아니라 상대경로를 쓴다. 별칭은 Nuxt만 알기 때문에
// scripts/check-bus-logic.ts를 node로 직접 돌릴 때 해석되지 않는다. (→ tourApi.ts의 같은 주석)
import { MESSAGES, type Locale } from '../i18n/messages.ts'

/**
 * 화면 표시용 포맷
 *
 * 여기 있는 함수는 전부 "숫자를 사람 말로" 바꾸는 일만 한다.
 * 판단(운행 중인가, 막차가 지났는가)은 서버가 이미 끝냈으므로 여기서 다시 하지 않는다.
 *
 * ⚠️ `locale`은 **마지막 인자이고 기본값이 'ko'**다. 국문이 정본이라는 뜻이기도 하고,
 *    `scripts/check-bus-logic.ts`가 이 함수들을 Nuxt 밖에서 직접 부르기 때문이기도 하다.
 *    필수 인자로 만들면 그 회귀 테스트가 언어 인자를 나르는 일만 하게 된다.
 */

/**
 * 1km 미만은 m, 이상은 소수 첫째 자리 km
 *
 * 30m 미만은 "바로 앞"이다. 위치 폴백을 쓰면 기준점이 정류장 좌표와 정확히
 * 겹쳐 "0m"가 나오는데, 그건 거리가 아니라 계산 결과가 새어 나온 것처럼 보인다.
 *
 * 영문은 숫자와 단위를 띄운다(`120 m`). 국문 조판에서는 붙이는 게 자연스럽지만
 * 영문에서 `120m`은 조밀해 보인다.
 */
export function formatDistance(meters: number, locale: Locale = 'ko'): string {
  if (meters < 30) return MESSAGES[locale].distance.rightHere

  const space = locale === 'ko' ? '' : ' '
  if (meters < 1000) return `${meters}${space}m`
  return `${(meters / 1000).toFixed(1)}${space}km`
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
export function formatArrival(
  predictTm: number | null,
  remainStation: number | null,
  locale: Locale = 'ko',
): string {
  const t = MESSAGES[locale]
  if (predictTm !== null) return `${predictTm}${t.common.minuteUnit} ${t.bus.after}`.trim()
  if (remainStation !== null) return t.common.stopsAway(remainStation)
  return t.bus.noInfo
}

/**
 * 갱신한 지 얼마나 됐는지
 *
 * "실시간"이라고 써 붙인 값이 실제로 언제 것인지 말한다. 탭을 백그라운드에 두면
 * 갱신을 건너뛰므로(홈의 30초 타이머), 배지만 뛰고 값은 몇 분 묵어 있을 수 있다.
 */
export function formatAgo(from: number, now: number, locale: Locale = 'ko'): string {
  const t = MESSAGES[locale].realtime
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 45) return t.justNow
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return t.minutesAgo(minutes)
  return t.hoursAgo(Math.round(minutes / 60))
}

/**
 * 카카오맵 길찾기 링크
 *
 * 이 서비스는 "어느 정류장, 몇 분 후"까지 답하고 거기서 끊긴다. 실제 여행자는
 * 그다음 카카오맵을 따로 켠다. 그 한 걸음을 링크로 잇는다.
 *
 * `link/to`는 목적지만 넘기면 출발지를 앱이 현재 위치로 잡는다. 우리가 사용자 좌표를
 * URL에 실어 보낼 필요가 없다 — ADR-024와 어긋나지 않는다.
 * (실리는 좌표는 정류장·관광지의 공개 좌표다)
 *
 * 이름에 쉼표가 들어가면 파라미터가 밀린다. "경안중.경안여고"처럼 구두점이 섞인
 * 이름이 실제로 있어 인코딩해서 넘긴다.
 */
export function kakaoDirectionsUrl(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
}

/**
 * "교보생명 -> 하회마을"을 방향 문구로 바꾼다.
 *
 * via는 명세서에 없지만 실제로 오는 필드이고, 여행자가 정류장에서 가장 헷갈리는
 * "이게 내가 가려는 방향인가"에 답하는 정보다. 종점만 남겨 짧게 보여준다.
 */
/**
 * ⚠️ **종점이 비어서 온다.** 실측(2026-08-14): 표본 50건이 전부 `"청호한우촌앞 -> "`
 *    꼴이었다. 하루 전(08-13)에는 `"정부경북지방합동청사 -> 국립경국대"`로 채워져
 *    왔으므로 상류가 조용히 바뀐 것이다. 예전에는 이때 via를 그대로 돌려줘서
 *    화면에 화살표만 덩그러니 남았다("청호한우촌앞 -> · 11정거장 전").
 *
 *    대신 `routeNm`을 쓴다. `"610(만휴정-길안-국립경국대-교보건너-안동터미널)"`처럼
 *    괄호 안 마지막 토큰이 종점이다. 상류가 via를 다시 채우면 via가 우선한다.
 *
 *    둘 다 없으면 **빈 문자열**이다. 호출부는 이때 줄 자체를 지워야 한다 —
 *    "-> " 같은 조각을 사람에게 보여주느니 아무것도 안 보여주는 편이 낫다.
 *
 * 회귀 검증: `node scripts/check-bus-logic.ts`
 */
export function formatDirection(via: string, routeNm?: string, locale: Locale = 'ko'): string {
  /**
   * ⚠️ 종점 이름은 **국문 그대로 나간다.** 영문 화면에서도 마찬가지다.
   *    이건 버스 API가 주는 정류장 문자열이고, 영문 대응이 있는 건 정류장
   *    목록(`stationEngNm`)뿐이라 노선 문자열 안의 지명은 맞출 상대가 없다.
   *    지어내면 "Toward Imha"라 적힌 화면을 들고 '임하'라 쓰인 버스를 찾게 된다.
   */
  const label = MESSAGES[locale].home.directionTag

  const destination = via.split('->').pop()?.trim()
  if (destination) return label(destination)

  const inside = routeNm?.match(/\(([^)]*)\)/)?.[1]
  const terminal = inside?.split('-').pop()?.trim()
  return terminal ? label(terminal) : ''
}
