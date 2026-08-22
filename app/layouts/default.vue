<script setup lang="ts">
import { LOCALES, MESSAGES } from '~/i18n/messages'

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
const languages = computed(() =>
  LOCALES.map((code) => ({
    code,
    label: MESSAGES[code].lang[code],
    to: pathIn(code, route.fullPath),
    current: code === locale.value,
  })),
)

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

useHead(() => ({
  htmlAttrs: { lang: t.value.htmlLang },
  meta: [{ name: 'description', content: t.value.description }],
  link: [
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

        <!--
          언어. 오른쪽 끝에 두 언어를 나란히 둔다.

          드롭다운을 쓰지 않는다. 언어가 둘뿐이라 여는 동작이 순수한 손해이고,
          닫혀 있는 동안 "영어가 있다"는 사실 자체가 숨는다. 외국인 여행자는
          국문 화면에서 이 두 글자를 찾아야 하는 사람이므로 늘 보여야 한다.
        -->
        <nav :aria-label="t.lang.label" class="ml-auto flex flex-none items-center gap-1">
          <NuxtLink
            v-for="language in languages"
            :key="language.code"
            :to="language.to"
            :aria-current="language.current ? 'true' : undefined"
            class="rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors tablet:px-3"
            :class="language.current ? 'bg-surface-strong text-ink' : 'text-muted hover:bg-surface-soft'"
          >
            {{ language.label }}
          </NuxtLink>
        </nav>
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
