<script setup lang="ts">
/**
 * 관광지 사진 — 폴백이 예외가 아니라 기본 경로다
 *
 * 인기 상위 6곳(월영교·하회마을·병산서원·봉정사·도산서원·만휴정)이 전부
 * KorService2에 없어 이미지가 없다. 즉 첫 화면에서 가장 먼저 보이는 카드들이
 * 폴백이다. "가끔 뜨는 대체 이미지"로 취급하면 안 된다. → ADR-021
 *
 * 상류 URL이 404를 주는 경우도 있어 @error에서도 폴백으로 되돌린다.
 */
const props = defineProps<{
  src?: string
  alt: string
}>()

const t = useT()

const failed = ref(false)

// 카드가 재사용되며 src가 바뀌면 실패 상태를 리셋한다.
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => Boolean(props.src) && !failed.value)
</script>

<template>
  <span class="block h-full w-full overflow-hidden bg-surface-strong">
    <img
      v-if="showImage"
      :src="src"
      :alt="alt"
      loading="lazy"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <span v-else class="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="h-8 w-8 text-muted-soft"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M3 16l5-4 4 3 3-2 6 4" />
      </svg>
      <span class="text-xs text-muted">{{ t.card.noPhoto }}</span>
    </span>
  </span>
</template>
