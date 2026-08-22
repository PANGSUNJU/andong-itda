<script setup lang="ts">
/**
 * 실시간 배지 — 언제 받은 값인지 말하고, 다시 받을 방법을 준다
 *
 * 점만 뛰는 배지는 "지금 이 순간"이라고 주장한다. 그런데 홈은 30초마다,
 * 그것도 탭이 보일 때만 갱신하고 상세는 아예 한 번만 받는다. 주장과 사실이 어긋난다.
 * 갱신 시각을 옆에 적고 새로고침을 붙여 그 어긋남을 사용자 손에 돌려준다.
 *
 * 도착 카드 둘(BusPanel · SpotBusPanel)이 같은 배지를 쓴다.
 */
const props = defineProps<{
  /** 도착 정보를 마지막으로 받은 시각(ms). SSR에서는 null이다. */
  updatedAt: number | null
  pending?: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()

const t = useT()
const locale = useLocale()

/**
 * 시각은 브라우저에서만 흐르게 둔다.
 * SSR에서 `Date.now()`를 찍으면 서버 시각으로 "방금"이 굳어 하이드레이션이 어긋난다.
 */
const now = ref(0)

onMounted(() => {
  now.value = Date.now()
  // 데이터가 그대로여도 "방금"은 늙는다. 값 갱신 주기(30초)와 별개로 표기만 따로 센다.
  const timer = setInterval(() => (now.value = Date.now()), 10_000)
  onUnmounted(() => clearInterval(timer))
})

const ago = computed(() =>
  props.updatedAt && now.value ? formatAgo(props.updatedAt, now.value, locale.value) : null,
)
</script>

<template>
  <span class="flex flex-none items-center gap-1.5 text-[13px] font-medium text-primary">
    <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
    {{ t.realtime.live }}
    <span v-if="ago" class="font-normal text-muted-soft">{{ ago }}</span>

    <button
      type="button"
      class="-my-1 rounded-full p-1 text-muted transition-colors hover:bg-surface-soft disabled:opacity-40"
      :disabled="pending"
      :aria-label="t.realtime.refresh"
      @click="emit('refresh')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        class="h-[15px] w-[15px]"
        :class="pending ? 'animate-spin' : ''"
        aria-hidden="true"
      >
        <path d="M20 11a8 8 0 10-1.6 5.6M20 5v6h-6" />
      </svg>
    </button>
  </span>
</template>
