<script setup lang="ts">
/**
 * 전역 셸 — 상단 네비(태블릿 이상) + 하단 탭바(폰)
 *
 * 두 네비게이션은 같은 3개 목적지를 가리킨다. 브레이크포인트로 하나만 보인다.
 * 관광지 상세는 별도 목적지가 아니라 "둘러보기"의 하위이므로 그쪽을 현재 위치로 표시한다.
 *
 * 경계는 tablet(744px)이다. desktop(1128px)으로 두면 태블릿과 작은 노트북이
 * 가로 공간이 충분한데도 엄지용 하단 탭바를 받는다. 하단 탭바는 손이 닿는
 * 거리가 이유인 UI이므로, 그 이유가 사라지는 폭에서는 상단 네비가 맞다.
 */
const NAV = [
  { to: '/', label: '지금 여기' },
  { to: '/browse', label: '둘러보기' },
  { to: '/walk', label: '걷는 길' },
] as const

const route = useRoute()

/** 상세(/spots/…)에 있을 때 하이라이트할 탭 */
const activePath = computed(() => (route.path.startsWith('/spots') ? '/browse' : route.path))
</script>

<template>
  <div class="min-h-screen pb-20 tablet:pb-0">
    <header class="sticky top-0 z-50 border-b border-hairline-soft bg-white">
      <div class="mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-6">
        <NuxtLink to="/" class="flex flex-none items-center gap-2">
          <!-- 색은 AppLogo가 토큰으로 직접 칠한다. text-* 를 얹어도 먹지 않는다. -->
          <AppLogo class="h-[30px] w-[30px]" />
          <!--
            먹이다. 공식 락업(public/logo/lockup-light.svg)이 워드마크를
            #222222로 쓴다. 주홍으로 두면 심볼의 붉은 발자국과 글자가 함께
            붉어져 강조가 두 번 걸리고, 락업과도 어긋난다.
          -->
          <b class="text-xl font-bold tracking-[-0.4px] text-ink">안동잇다</b>
        </NuxtLink>

        <nav class="ml-8 hidden gap-1 tablet:flex">
          <NuxtLink
            v-for="item in NAV"
            :key="item.to"
            :to="item.to"
            class="rounded-full px-4 py-2.5 text-base font-semibold leading-tight transition-colors"
            :class="
              activePath === item.to
                ? 'bg-surface-strong text-ink'
                : 'text-muted hover:bg-surface-soft'
            "
          >
            {{ item.label }}
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
        <NuxtLink to="/about" class="font-medium text-muted underline">
          안내 · 데이터 출처
        </NuxtLink>
        <span>한국관광공사 · 안동시 공공데이터</span>
      </div>
    </footer>

    <!-- 폰 하단 탭바. 태블릿 이상에서는 상단 네비가 대신한다. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-50 flex h-16 border-t border-hairline bg-white tablet:hidden"
    >
      <NuxtLink
        v-for="item in NAV"
        :key="item.to"
        :to="item.to"
        class="flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
        :class="activePath === item.to ? 'text-primary' : 'text-muted'"
      >
        <AppNavIcon :name="item.to" class="h-[22px] w-[22px]" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
