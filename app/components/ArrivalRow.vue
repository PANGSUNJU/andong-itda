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
  /**
   * 이 버스가 닿는 관광지. 홈에서만 온다.
   * 관광지 상세는 이미 목적지를 알고 들어온 화면이라 다시 말할 이유가 없다.
   * → ADR-025
   */
  spots?: import('#shared/types/bus').ArrivalSpot[]
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

      <!-- 종점이 아니라 이 버스가 실제로 지나는 관광지다. 없으면 줄 자체가 없다. -->
      <span
        v-if="spots?.length"
        class="block truncate text-[13px] font-medium leading-tight text-primary"
      >
        {{ spots[0]!.name }}<template v-if="spots.length > 1"> 외 {{ spots.length - 1 }}곳</template>
        방면
      </span>

      <span v-if="remainStation !== null" class="block text-[13px] leading-tight text-muted">
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
