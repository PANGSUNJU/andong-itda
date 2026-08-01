<script setup lang="ts">
/**
 * 도착 한 줄 — 노선번호 / 방향 / 도착까지
 *
 * BusArrival 전체가 아니라 화면이 쓰는 네 필드만 받는다.
 * /api/spot-bus는 애초에 이 네 개만 내려주므로 두 화면이 같은 컴포넌트를 쓴다.
 */
defineProps<{
  routeNum: string
  via: string
  predictTm: number | null
  remainStation: number | null
}>()
</script>

<template>
  <div class="flex w-full items-center gap-3 border-t border-hairline-soft py-3 text-left">
    <span
      class="min-w-[60px] flex-none rounded-sm bg-surface-strong px-2.5 py-1.5 text-center text-sm font-semibold"
    >
      {{ routeNum }}
    </span>

    <span class="min-w-0 flex-1">
      <b class="block truncate text-base font-medium leading-tight">{{ formatDirection(via) }}</b>
      <span v-if="remainStation !== null" class="text-[13px] leading-tight text-muted">
        {{ remainStation }}정거장 전
      </span>
    </span>

    <span class="flex-none text-right">
      <b class="block text-base font-semibold leading-tight">
        {{ predictTm !== null ? `${predictTm}분` : '—' }}
      </b>
      <span class="mt-0.5 block text-[13px] text-muted">
        {{ predictTm !== null ? '후' : '위치 확인 중' }}
      </span>
    </span>
  </div>
</template>
