<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * 오류 화면 — 없으면 배포본이 JSON을 날것으로 뱉는다
 *
 * 이 파일이 없던 동안 `https://andong-itda.vercel.app/spots/<없는id>`는 이렇게 응답했다.
 *
 *   { "error": true, "statusCode": 404,
 *     "statusMessage": "찾을 수 없는 관광지예요", "message": "Server Error" }
 *
 * `/spots/[id]`가 `createError({ fatal: true })`를 던지는데 받을 화면이 없어서다.
 * 링크 하나 잘못 눌린 사람에게 "Server Error"라고 적힌 중괄호를 보여주면
 * 그 사람이 본 것은 없는 관광지가 아니라 고장 난 서비스다.
 *
 * `<NuxtLayout>`으로 감싼다. 오류 화면에서 헤더가 사라지면 돌아갈 길이
 * 뒤로가기밖에 안 남는다. 셸의 축제 아이콘은 실패해도 빈 배열로 떨어지므로
 * (→ `FestivalBadge`) 이 화면을 다시 깨뜨리지 않는다.
 */
const props = defineProps<{ error: NuxtError }>()

const t = useT()
const route = useRoute()
const localePath = useLocalePath()

const status = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => status.value === 404)

/**
 * 없는 관광지는 "없는 페이지"보다 구체적으로 말할 수 있다.
 *
 * 상류에서 온 `statusMessage`를 그대로 쓰지 않는다. 그건 서버가 국문으로만
 * 만든 문자열이라 영문 화면에서 국문이 튀어나온다. 경로로 판정하고 문구는
 * 사전에서 꺼낸다. → ADR-031
 */
const isSpot = computed(() => barePath(route.path).startsWith('/spots'))

const title = computed(() => {
  if (!isNotFound.value) return t.value.error.titleServer
  return isSpot.value ? t.value.spot.notFound : t.value.error.title404
})

const body = computed(() =>
  isNotFound.value ? t.value.error.body404 : t.value.error.bodyServer,
)

useHead(() => ({ title: `${title.value} · ${t.value.brand}` }))

/**
 * 다시 시도 — 오류를 지우고 같은 주소를 다시 연다.
 *
 * 404에는 붙이지 않는다. 없는 주소는 다시 열어도 없다. 버튼이 아무것도
 * 바꾸지 못하면 그건 길이 아니라 막다른 골목을 하나 더 만드는 것이다.
 */
function retry() {
  clearError({ redirect: route.fullPath })
}
</script>

<template>
  <NuxtLayout>
    <div class="mx-auto max-w-[680px] px-6 py-20 tablet:py-28">
      <p class="text-sm font-medium text-muted-soft">{{ t.error.code(status) }}</p>

      <h1 class="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        {{ title }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ body }}</p>

      <!--
        갈 곳을 준다. 오류 화면의 일은 사과가 아니라 다음 걸음을 만드는 것이다.
        홈이 먼저다 — 이 서비스는 "지금 여기"에서 시작한다.
      -->
      <div class="mt-6 flex flex-wrap gap-2">
        <NuxtLink
          :to="localePath('/')"
          class="rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          {{ t.error.goHome }}
        </NuxtLink>
        <NuxtLink
          :to="localePath('/browse')"
          class="rounded-sm border border-hairline px-4 py-2 text-sm font-medium hover:bg-surface-soft"
        >
          {{ t.error.goBrowse }}
        </NuxtLink>
        <button
          v-if="!isNotFound"
          type="button"
          class="rounded-sm border border-hairline px-4 py-2 text-sm font-medium hover:bg-surface-soft"
          @click="retry()"
        >
          {{ t.error.retry }}
        </button>
      </div>
    </div>
  </NuxtLayout>
</template>
