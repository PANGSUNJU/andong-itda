<script setup lang="ts">
/**
 * 지도 자리 — 카카오맵이 들어올 슬롯
 *
 * ADR-013에서 카카오맵을 부분 배치하기로 했으나 JavaScript 키가 아직 없다.
 * 키가 없는 동안 그림으로 지도를 흉내 내지 않는다. 위치 서비스에서
 * 실제와 다른 지도는 없는 지도보다 나쁘다.
 *
 * 키가 발급되면 이 컴포넌트 안만 바꾸면 된다. 배치와 높이는 이미 확정되어 있다.
 */
defineProps<{
  /** 지도가 없는 동안 대신 알려줄 문구 */
  caption: string
  height?: string
}>()

const { kakaoMapKey } = useRuntimeConfig().public
</script>

<template>
  <div class="overflow-hidden rounded-md border border-hairline">
    <div
      class="flex items-center justify-center bg-surface-soft px-6 text-center"
      :style="{ height: height ?? '220px' }"
    >
      <div v-if="!kakaoMapKey">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          class="mx-auto h-7 w-7 text-muted-soft"
          aria-hidden="true"
        >
          <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13" />
        </svg>
        <p class="mt-2 text-sm text-muted">지도 준비 중</p>
      </div>
    </div>
    <p class="border-t border-hairline-soft px-4 py-3 text-[13px] text-muted">{{ caption }}</p>
  </div>
</template>
