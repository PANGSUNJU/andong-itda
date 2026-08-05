<script setup lang="ts">
import { NuxtLink } from '#components'
import type { Spot } from '#shared/types/tour'

/**
 * 관광지 카드 — 둘러보기 그리드의 단위
 *
 * 순위 배지는 API가 준 rank를 그대로 쓴다. hubRank는 매월 바뀌므로
 * 어떤 순위도 코드에 적어두지 않는다. → ADR-021
 */
const props = defineProps<{
  spot: Spot
  /** 상위 몇 위까지 강조 배지를 붙일지 */
  highlightTop?: number
  /**
   * 카드가 여는 상세 페이지. null이면 링크를 만들지 않는다.
   *
   * 음식점이 그 경우다. /spots/[id]는 /api/spots에서 id를 찾는데 음식점은
   * 거기 없어서 404가 된다. 갈 곳이 없는 링크를 만드느니 링크를 안 만든다. → ADR-023
   */
  to?: string | null
}>()

// undefined는 "안 넘겼다"(=기본 상세 링크), null은 "링크 없음"이다. 둘을 구분한다.
const link = computed(() => (props.to === undefined ? `/spots/${props.spot.id}` : props.to))

const isTop = computed(
  () => props.spot.rank !== null && props.spot.rank <= (props.highlightTop ?? 3),
)

/**
 * 도보 시간은 걸어갈 만한 거리에서만 뜻이 있다.
 * 4.4km 떨어진 곳에 "걸어서 약 66분"을 붙이면 버스를 타야 한다는 사실을 가린다.
 */
const WALKABLE_M = 2000
const showWalk = computed(
  () => props.spot.distance !== undefined && props.spot.distance <= WALKABLE_M,
)
</script>

<template>
  <component :is="link ? NuxtLink : 'div'" :to="link ?? undefined" class="group block text-left">
    <span class="relative block aspect-square overflow-hidden rounded-md">
      <SpotPhoto :src="spot.imageUrl" :alt="spot.name" />

      <span
        v-if="spot.rank !== null"
        class="absolute left-2.5 top-2.5 w-max rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight shadow-float"
        :class="isTop ? 'bg-primary text-white' : 'bg-white text-ink'"
      >
        {{ spot.rank }}위
      </span>
    </span>

    <span class="block pt-3">
      <b class="block truncate text-base font-semibold leading-tight">{{ spot.name }}</b>
      <span class="mt-0.5 block truncate text-sm text-muted">
        {{ spot.category }}<template v-if="spot.address"> · {{ shortAddress(spot.address) }}</template>
      </span>
      <span v-if="spot.distance !== undefined" class="mt-1.5 block text-sm text-ink">
        <em class="font-semibold not-italic">{{ formatDistance(spot.distance) }}</em>
        <template v-if="showWalk"> · 걸어서 약 {{ spot.walkMinutes }}분</template>
        <template v-else> · 버스로 가는 거리</template>
      </span>
    </span>
  </component>
</template>
