<script setup lang="ts">
import { MESSAGES, type Locale } from '~/i18n/messages'
import { LOCALES } from '#shared/constants/locale'

/**
 * 전역 셸 — 상단 네비(태블릿 이상) + 하단 탭바(폰)
 *
 * 두 네비게이션은 같은 3개 목적지를 가리킨다. 브레이크포인트로 하나만 보인다.
 * 관광지 상세는 별도 목적지가 아니라 "둘러보기"의 하위이므로 그쪽을 현재 위치로 표시한다.
 *
 * 경계는 tablet(744px)이다. desktop(1128px)으로 두면 태블릿과 작은 노트북이
 * 가로 공간이 충분한데도 엄지용 하단 탭바를 받는다. 하단 탭바는 손이 닿는
 * 거리가 이유인 UI이므로, 그 이유가 사라지는 폭에서는 상단 네비가 맞다.
 *
 * 링크는 전부 국문 경로로 적고 `localePath`가 지금 언어를 붙인다. 셸은 모든
 * 화면에 있으므로 여기서 한 번 새면 영문 화면 어디서든 국문으로 떨어진다. → ADR-031
 */
const NAV = ['/', '/browse', '/walk'] as const

const route = useRoute()
const locale = useLocale()
const t = useT()
const localePath = useLocalePath()

const label = computed(() => ({
  '/': t.value.nav.home,
  '/browse': t.value.nav.browse,
  '/walk': t.value.nav.walk,
}))

/** 상세(/spots/…)에 있을 때 하이라이트할 탭. 언어 접두어를 뗀 경로로 비교한다. */
const activePath = computed(() => {
  const path = barePath(route.path)
  return path.startsWith('/spots') ? '/browse' : path
})

/**
 * 언어 링크 — 같은 화면의 다른 주소
 *
 * 홈으로 되돌리지 않는다. 하회마을 상세를 보다 영문을 누른 사람이 원하는 것은
 * 영문 홈이 아니라 영문으로 된 하회마을 상세다. `fullPath`를 쓰므로 검색어 같은
 * 쿼리도 함께 넘어간다.
 */
/**
 * 반대편 언어 하나. 화면에는 지금 언어가 아니라 **갈 곳**이 적힌다.
 *
 * 이름은 그 언어로 쓴다("English"·"한국어"). 읽을 사람이 그 언어 사용자다.
 */
const otherLanguage = computed(() => {
  const code = LOCALES.find((candidate) => candidate !== locale.value) ?? 'en'
  return { code, label: MESSAGES[code].lang[code], to: pathIn(code, route.fullPath) }
})

/**
 * 언어별 메타 — `<html lang>`과 hreflang
 *
 * `lang`이 틀리면 스크린리더가 영문 화면을 국문 음성으로 읽는다.
 * hreflang은 검색엔진에 "이 둘은 같은 화면의 다른 언어"라고 알려 준다. 없으면
 * 두 주소가 중복 문서로 취급되어 한쪽이 색인에서 밀린다.
 *
 * x-default는 국문이다. 이 서비스의 정본이 국문이고, 안동에서 이 화면을 여는
 * 사람의 절대다수가 한국어 사용자다.
 */
/**
 * ⚠️ setup 안에서 한 번만 부른다. `computed` 안에 넣으면 그 계산이 SSR 렌더 중
 *    Nuxt 인스턴스 밖에서 돌아 500이 난다(`useRequestEvent`가 인스턴스를 요구한다).
 *    오리진은 페이지가 사는 동안 변하지 않으므로 반응형일 이유도 없다.
 */
const origin = useRequestURL().origin

/**
 * 공유 카드 — 링크를 붙여넣었을 때 뜨는 그림과 문장
 *
 * 없으면 회색 빈 상자가 뜬다. 이 서비스가 사람에게 닿는 경로가 대부분 링크
 * (숙소·안내소·심사위원에게 보낸 URL)인데, 그 첫인상이 빈 상자였다.
 *
 * 제목은 페이지가 정한다(→ `usePageTitle`). 여기서는 페이지마다 달라지지 않는
 * 것만 붙인다 — 설명·이미지·주소·언어. 제목을 여기서도 쓰면 두 자리가 서로
 * 다른 문장을 말하는 날이 온다.
 *
 * ⚠️ og:image는 **절대 주소**여야 한다. 스크래퍼는 우리 페이지 밖에서 이미지를
 *    받으러 오므로 `/og-card.png`처럼 상대 주소로 적으면 아무것도 못 받는다.
 */
const shareImage = computed(() => `${origin}/og-card.png`)

/** 이 화면의 정본 주소. 쿼리는 뺀다 — 검색어가 달라도 같은 문서다. */
const canonical = computed(() => `${origin}${route.path}`)

/** og가 요구하는 표기는 `ko`가 아니라 `ko_KR`이다. */
const OG_LOCALE: Record<Locale, string> = { ko: 'ko_KR', en: 'en_US' }

useHead(() => ({
  htmlAttrs: { lang: t.value.htmlLang },
  meta: [
    { name: 'description', content: t.value.description },

    { property: 'og:site_name', content: t.value.brand },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: canonical.value },
    { property: 'og:description', content: t.value.description },
    { property: 'og:image', content: shareImage.value },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:alt', content: t.value.brand },
    { property: 'og:locale', content: OG_LOCALE[locale.value] },
    ...LOCALES.filter((code) => code !== locale.value).map((code) => ({
      property: 'og:locale:alternate',
      content: OG_LOCALE[code],
    })),

    // 이미지가 1.91:1이라 큰 카드를 쓴다. 정사각 로고였다면 summary가 맞다.
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:description', content: t.value.description },
    { name: 'twitter:image', content: shareImage.value },
  ],
  link: [
    { rel: 'canonical', href: canonical.value },
    ...LOCALES.map((code) => ({
      rel: 'alternate',
      hreflang: code,
      href: `${origin}${pathIn(code, route.path)}`,
    })),
    { rel: 'alternate', hreflang: 'x-default', href: `${origin}${pathIn('ko', route.path)}` },
  ],
}))
</script>

<template>
  <div class="min-h-screen pb-20 tablet:pb-0">
    <header class="sticky top-0 z-50 border-b border-hairline-soft bg-white">
      <div class="mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-6">
        <NuxtLink :to="localePath('/')" class="flex flex-none items-center gap-2">
          <!-- 색은 AppLogo가 토큰으로 직접 칠한다. text-* 를 얹어도 먹지 않는다. -->
          <AppLogo class="h-[30px] w-[30px]" />
          <!--
            먹이다. 공식 락업(public/logo/lockup-light.svg)이 워드마크를
            #222222로 쓴다. 주홍으로 두면 심볼의 붉은 발자국과 글자가 함께
            붉어져 강조가 두 번 걸리고, 락업과도 어긋난다.
          -->
          <b class="text-xl font-bold tracking-[-0.4px] text-ink">{{ t.brand }}</b>
        </NuxtLink>

        <nav class="ml-8 hidden gap-1 tablet:flex">
          <NuxtLink
            v-for="item in NAV"
            :key="item"
            :to="localePath(item)"
            class="rounded-full px-4 py-2.5 text-base font-semibold leading-tight transition-colors"
            :class="
              activePath === item ? 'bg-surface-strong text-ink' : 'text-muted hover:bg-surface-soft'
            "
          >
            {{ label[item] }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex flex-none items-center gap-1.5 tablet:gap-2">
          <!--
            축제. 열리고 있거나 곧 열릴 때만 나타난다. 없는 날에는 이 자리가
            통째로 비고 언어 링크가 그대로 오른쪽 끝을 차지한다.

            NAV에 넣지 않은 이유는 아래 안내 링크와 같다 — 목적지가 아니고,
            넣으면 모바일 탭바가 4칸이 된다. 게다가 축제는 대부분의 날에 0건이라
            탭으로 두면 주 동선 하나를 내주고 빈 화면을 얻는다. → ADR-035
          -->
          <FestivalBadge />

          <!--
            언어. 반대편 하나만 둔다.

            두 언어를 나란히 두고 지금 언어를 칠해 두던 방식이었다. 그때도 "영어가
            있다"는 사실은 보였지만, 외국인 여행자는 **둘 중 어느 쪽이 눌리는지**를
            먼저 판단해야 했다. 갈 곳 하나만 적으면 그 판단이 사라진다.
            폰에서 헤더 폭이 한 칸 넉넉해지는 것은 덤이다.

            ⚠️ 버튼이 아니라 **링크**다. 언어는 주소이므로(ADR-031) 새 탭으로 열 수
               있어야 하고 검색엔진이 따라갈 수 있어야 한다. 토글을 자바스크립트로
               만들면 둘 다 잃는다.

            `lang`·`hreflang`을 붙인다. 없으면 스크린리더가 국문 화면의 "English"를
            국문 음성으로 읽는다. 눈에 보이는 글자는 한 단어지만 읽히는 것은 그 단어의
            언어까지다.
          -->
          <NuxtLink
            :to="otherLanguage.to"
            :lang="otherLanguage.code"
            :hreflang="otherLanguage.code"
            :aria-label="t.lang.switch"
            class="flex-none rounded-full border border-hairline px-3 py-1.5 text-[13px] font-medium text-body transition-colors hover:bg-surface-soft"
          >
            {{ otherLanguage.label }}
          </NuxtLink>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <!--
      안내는 NAV에 넣지 않는다. 목적지가 아니라 참고 자료이고,
      넣으면 모바일 탭바가 4칸이 되어 주 동선 셋이 좁아진다.
    -->
    <footer class="border-t border-hairline-soft">
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-1 px-6 py-6 text-[13px] text-muted-soft"
      >
        <NuxtLink :to="localePath('/about')" class="font-medium text-muted underline">
          {{ t.footer.about }}
        </NuxtLink>
        <span>{{ t.footer.source }}</span>
      </div>
    </footer>

    <!-- 폰 하단 탭바. 태블릿 이상에서는 상단 네비가 대신한다. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-50 flex h-16 border-t border-hairline bg-white tablet:hidden"
    >
      <NuxtLink
        v-for="item in NAV"
        :key="item"
        :to="localePath(item)"
        class="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
        :class="activePath === item ? 'text-primary' : 'text-muted'"
      >
        <AppNavIcon :name="item" class="h-[22px] w-[22px]" />
        {{ label[item] }}
      </NuxtLink>
    </nav>
  </div>
</template>
