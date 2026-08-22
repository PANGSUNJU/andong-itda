import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  vite: {
    plugins: [tailwindcss()],
  },

  css: ['~/assets/css/main.css'],

  /**
   * 언어를 주소로 가른다 — `/`는 국문, `/en`은 영문 → ADR-031
   *
   * `app/pages/`에서 만들어진 라우트를 통째로 한 벌 더 만들어 `/en`을 붙인다.
   * 페이지 파일을 복제하지 않는 것이 요점이다. 두 벌을 두면 화면 로직을 고칠 때마다
   * 두 곳을 고쳐야 하고, 한쪽만 고친 날 국문과 영문 화면이 다르게 동작한다.
   * 같은 컴포넌트가 그리되 언어만 주소에서 읽는다(`useLocale`).
   *
   *   /            → /en
   *   /browse      → /en/browse
   *   /spots/:id() → /en/spots/:id()
   *
   * 자동 리다이렉트는 넣지 않는다. `Accept-Language`가 영문이라고 해서 한국인을
   * 영문 화면으로 보내면(국내 브라우저도 영문 로캘이 흔하다) 정본 화면을 뺏는 셈이다.
   * 언어는 헤더에 붙은 링크로 사람이 고른다.
   *
   * ⚠️ `pages` 자체를 순회하면서 push하면 방금 만든 영문 라우트를 다시 복제한다.
   *    먼저 사본 배열을 만들고 나서 붙인다.
   */
  hooks: {
    'pages:extend'(pages) {
      const english = pages.map((page) => ({
        ...page,
        // 이름은 라우트를 구분하기만 하면 된다. 경로가 이미 유일하므로 그것을 쓴다.
        name: `en-${page.name ?? page.path}`,
        path: page.path === '/' ? '/en' : `/en${page.path}`,
      }))

      pages.push(...english)
    },
  },

  /**
   * 인증키 관리
   *
   * tourApiKey는 서버에서만 접근한다. 클라이언트 번들에 포함되면 안 된다.
   * kakaoMapKey는 브라우저에서 스크립트를 로드해야 하므로 public에 둔다.
   * 노출되는 것이 전제이므로 카카오 콘솔에서 도메인 제한을 반드시 설정한다.
   */
  runtimeConfig: {
    tourApiKey: process.env.TOUR_API_KEY,

    public: {
      kakaoMapKey: process.env.NUXT_PUBLIC_KAKAO_MAP_KEY,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'ko' },
      title: '안동잇다',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            '차 없이 안동을 여행하는 사람을 위한 안내. 버스를 기다리는 시간에 다녀올 수 있는 곳을 알려드립니다.',
        },
        { name: 'theme-color', content: '#ffffff' },
      ],

      /**
       * 파비콘 — public/logo/ 의 파생물을 명시적으로 가리킨다
       *
       * 이 link가 없으면 브라우저는 관례대로 /favicon.ico만 찾는다.
       * 그 파일은 옛 핀 로고이고 새 심볼로 다시 만들어지지 않았으므로,
       * 명시하지 않으면 새 로고가 탭에 영원히 안 나온다.
       *
       * svg를 먼저 둔다. 지원하는 브라우저는 이걸 쓰고 해상도에 상관없이 선명하다.
       * png 두 벌은 svg를 안 받는 브라우저용이고, apple-touch-icon은
       * iOS 홈 화면 추가용이라 크기가 따로 정해져 있다.
       */
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo/favicon-src.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/logo/png/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/logo/png/favicon-16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/logo/png/apple-touch-icon-180.png' },
      ],
    },
  },
})
