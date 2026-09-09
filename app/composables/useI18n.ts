import { MESSAGES, categoryLabel, type Locale } from '~/i18n/messages'

/**
 * 주소 규칙은 `shared/`에 있다(사이트맵도 같은 것을 쓴다). 화면에서는 여기서
 * 자동 임포트되던 이름이 그대로 살아 있어야 하므로 다시 내보낸다.
 *
 * ⚠️ `export … from`만 쓰면 안 된다. 다시 내보내기는 이 파일의 **지역 범위에
 *    이름을 들이지 않아서**, 바로 아래 `useLocalePath()`가 부르는 `pathIn`이
 *    런타임에 undefined가 된다. 자동 임포트는 그 이름을 내보내는 파일 자신에는
 *    주입되지 않으므로 타입 검사만으로는 안 걸린다(전역 타입은 있고 값은 없다).
 *    들여오고 나서 내보낸다.
 */
import { barePath, localeOf, pathIn } from '#shared/constants/locale'

export { barePath, localeOf, pathIn }

/**
 * 언어 — 주소가 정본이다
 *
 * `/`가 국문, `/en`이 영문이다. 같은 주소를 토글로 갈아끼우지 않는다. → ADR-031
 *
 * 쿠키도 `useState`도 쓰지 않는다. 상태를 따로 들면 그 상태와 주소가 어긋나는
 * 순간이 반드시 온다(새로고침·뒤로가기·공유받은 링크). 주소 하나만 보면
 * 서버와 브라우저가 같은 답을 내므로 **첫 페인트부터 맞는 언어로 나온다.**
 *
 * 덤으로 얻는 것이 크다.
 *   공유    영문 화면을 그대로 링크로 보낼 수 있다. 받는 쪽이 다시 고르지 않는다
 *   검색    두 언어가 각자의 주소를 가져 색인된다. 토글은 색인되지 않는다
 *   캐시    주소가 다르니 SSR 결과를 언어별로 캐시해도 섞이지 않는다
 */

/** 지금 보고 있는 페이지의 언어 */
export function useLocale() {
  const route = useRoute()
  return computed(() => localeOf(route.path))
}

/**
 * 현재 언어의 문구
 *
 * `<script setup>`에서 `const t = useT()`로 받으면 템플릿에서는 ref가 자동으로
 * 벗겨져 `t.nav.home`으로 쓴다. 스크립트 안에서는 `t.value.nav.home`이다.
 */
export function useT() {
  const locale = useLocale()
  return computed(() => MESSAGES[locale.value])
}

/**
 * 내부 링크 — 지금 언어를 유지한다
 *
 * ⚠️ 앱 안의 `<NuxtLink :to>`는 **전부** 이걸 거쳐야 한다. 하나라도 빠지면
 *    영문 화면을 보던 사람이 그 링크에서 국문으로 떨어지고, 돌아올 방법은
 *    뒤로가기뿐이다. 인자는 언제나 국문 경로(`/browse`)로 쓴다.
 */
export function useLocalePath() {
  const locale = useLocale()
  return (path: string) => pathIn(locale.value, path)
}

/**
 * 데이터에 붙은 이름과 분류의 표시값
 *
 * **한 화면에는 한 언어만 둔다.** 국문 화면에 영문을, 영문 화면에 국문을
 * 나란히 붙이던 방식은 걷어냈다. 두 언어가 겹쳐 있으면 읽는 사람은 자기
 * 언어가 아닌 줄을 매번 건너뛰어야 하고, 그 줄이 붙은 항목과 안 붙은 항목이
 * 섞여 목록의 줄 수가 들쭉날쭉해진다. → ADR-032
 *
 * ⚠️ 그래도 영문 화면에서 국문이 사라지지는 않는다. 영문 이름은 관광지 54곳 중
 *    17곳, 음식점 15곳 중 2곳에만 있어 **없으면 국문을 그대로 보여준다.**
 *
 *    로마자로 옮겨 지어내지 않는다. 여행자가 현장에서 볼 간판·정류장 표지·
 *    지도 앱이 전부 국문이라, 우리만 아는 영문명을 만들면 그 이름으로는 길을
 *    물을 수도 검색할 수도 없다. 국문이 남는 건 결함이 아니라 상류 데이터의
 *    사실이고, 그 사실대로 보여주는 편이 쓸모 있다.
 *
 *    정류장은 다르다. `stationEngNm`이 2105곳 전부 채워져 오므로 영문 화면에서
 *    정류장 이름은 사실상 항상 영문이다. 외국인이 가장 먼저 막히는 "내가 선
 *    정류장이 어디인가"가 여기서 풀린다. → ADR-030
 */
export function useDisplay() {
  const locale = useLocale()

  /** 이름. 영문이 있으면 영문, 없으면 국문. */
  function name(place: { name: string; nameEn?: string }): string {
    return locale.value === 'en' && place.nameEn ? place.nameEn : place.name
  }

  /** 정류장 이름. Spot과 필드명이 달라 따로 둔다. */
  function stationName(station: { stationNm: string; nameEn?: string }): string {
    return locale.value === 'en' && station.nameEn ? station.nameEn : station.stationNm
  }

  /** 분류. 모르는 값은 국문 그대로 나간다. */
  function category(value: string): string {
    return categoryLabel(value, locale.value)
  }

  /**
   * 이름순 정렬의 비교 기준
   *
   * 영문 화면에서 `'ko'`로 비교하면 영문명이 붙은 14곳과 국문으로 남은 40곳이
   * 서로 다른 규칙으로 줄을 서서 "이름순"이 이름순으로 안 보인다.
   */
  function compareNames(a: { name: string; nameEn?: string }, b: { name: string; nameEn?: string }) {
    return name(a).localeCompare(name(b), locale.value)
  }

  /**
   * 상류가 국문으로만 준 문장의 영문 짝. 없으면 국문을 그대로 쓴다.
   * 정적 데이터(server/data)의 note·warning이 이 경우다.
   */
  function pick(ko: string | null | undefined, en: string | null | undefined): string | null {
    return (locale.value === 'en' ? (en ?? ko) : ko) ?? null
  }

  return { locale, name, stationName, category, compareNames, pick }
}
