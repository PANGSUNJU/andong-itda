import type { Spot } from '#shared/types/tour'
import { LOCALES, pathIn } from '#shared/constants/locale'

/**
 * 사이트맵 — 관광지 목록에서 만든다
 *
 * `public/sitemap.xml`로 두지 않는다. 관광지 44곳은 관광공사 API가 주는 것이고
 * 그 목록은 우리가 정하지 않는다. 손으로 적은 파일은 상류가 한 곳을 추가한 날부터
 * 조용히 틀린다. 여기서는 `/api/spots`를 그대로 읽으므로 어긋날 자리가 없다.
 *
 * 두 언어를 각각의 주소로 싣는다(→ ADR-031). 같은 화면의 다른 언어라는 사실은
 * `xhtml:link`로 알린다. 없으면 두 주소가 중복 문서로 취급되어 한쪽이 밀린다.
 *
 * 1일 캐시한다. 관광지 목록 자체가 1일 캐시이므로 그보다 자주 만들 이유가 없다.
 */

/** 언어 접두어가 붙지 않은 정적 경로. 관광지 상세는 여기에 이어 붙인다. */
const STATIC_PATHS = ['/', '/browse', '/walk', '/about']

const buildSitemap = defineCachedFunction(
  async (origin: string): Promise<string> => {
    /**
     * 우리 라우트를 부른다. 원격을 직접 부르면 `/api/spots`의 1일 캐시를 버리고
     * 매번 관광공사를 다시 부른다. → `spot-bus/[spot].get.ts`의 같은 판단
     *
     * 실패해도 사이트맵 자체는 나가야 한다. 관광지가 빠진 사이트맵은 불완전하지만,
     * 500을 주면 크롤러는 사이트맵이 아예 없는 것으로 취급한다.
     */
    let spots: Spot[] = []
    try {
      spots = await $fetch<Spot[]>('/api/spots')
    } catch {
      console.warn('[sitemap] 관광지 목록을 받지 못했다. 정적 경로만 싣는다')
    }

    const paths = [...STATIC_PATHS, ...spots.map((spot) => `/spots/${spot.id}`)]

    const entries = paths.flatMap((path) =>
      LOCALES.map((locale) => {
        const alternates = [
          ...LOCALES.map(
            (code) =>
              `    <xhtml:link rel="alternate" hreflang="${code}" href="${origin}${pathIn(code, path)}"/>`,
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${origin}${pathIn('ko', path)}"/>`,
        ]

        return [
          '  <url>',
          `    <loc>${origin}${pathIn(locale, path)}</loc>`,
          ...alternates,
          '  </url>',
        ].join('\n')
      }),
    )

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...entries,
      '</urlset>',
      '',
    ].join('\n')
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'sitemap',
    // 미리보기 배포와 운영이 같은 캐시를 쓰면 서로의 도메인을 싣는다.
    getKey: (origin: string) => origin,
  },
)

export default defineEventHandler(async (event) => {
  const { origin } = getRequestURL(event)

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  // CDN이 대신 물고 있게 한다. s-maxage가 없으면 Vercel은 캐시하지 않는다.
  setHeader(event, 'cache-control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800')

  return await buildSitemap(origin)
})
