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
    },
  },
})
