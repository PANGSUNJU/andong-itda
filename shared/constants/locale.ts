/**
 * 언어와 주소 규칙 — 화면과 서버가 같은 것을 본다
 *
 * `/`가 국문, `/en`이 영문이다. 같은 주소를 토글로 갈아끼우지 않는다. → ADR-031
 *
 * 이 규칙이 `app/`이 아니라 `shared/`에 있는 이유는 사이트맵이다. 사이트맵은
 * 서버 라우트에서 만들어지는데 서버는 `app/`을 읽지 못한다. 규칙을 그쪽에 한 벌
 * 더 적으면, 언젠가 접두어를 바꾼 날 화면의 링크와 사이트맵이 다른 주소를 말한다.
 * 그런 어긋남은 배포된 뒤에 검색엔진 쪽에서만 드러나서 눈에 띄지 않는다.
 *
 * 문구 사전(`app/i18n/messages.ts`)은 여기 있지 않다. 그건 화면만 쓴다.
 */

export type Locale = 'ko' | 'en'

export const LOCALES: readonly Locale[] = ['ko', 'en']

/** 영문 페이지의 주소 접두어. 라우트를 만드는 쪽(nuxt.config)과 같은 값이다. */
const EN_PREFIX = '/en'

/** 이 경로가 어느 언어의 페이지인가. `/enough`처럼 접두어를 닮은 경로는 걸리지 않는다. */
export function localeOf(path: string): Locale {
  return path === EN_PREFIX || path.startsWith(`${EN_PREFIX}/`) ? 'en' : 'ko'
}

/** 언어 접두어를 뗀 경로. 국문 주소가 곧 이 서비스의 경로 체계다. */
export function barePath(path: string): string {
  if (path === EN_PREFIX) return '/'
  return path.startsWith(`${EN_PREFIX}/`) ? path.slice(EN_PREFIX.length) : path
}

/** 같은 화면의 다른 언어 주소. 언어 링크와 hreflang과 사이트맵이 같은 함수를 쓴다. */
export function pathIn(locale: Locale, path: string): string {
  const bare = barePath(path)
  if (locale === 'ko') return bare
  return bare === '/' ? EN_PREFIX : `${EN_PREFIX}${bare}`
}
