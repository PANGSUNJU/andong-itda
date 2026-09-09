<script setup lang="ts">
import { NuxtLink } from '#components'
import type { Spot } from '#shared/types/tour'
import { busMinutes } from '#shared/constants/location'

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

const t = useT()
const d = useDisplay()
const localePath = useLocalePath()

/**
 * undefined는 "안 넘겼다"(=기본 상세 링크), null은 "링크 없음"이다. 둘을 구분한다.
 *
 * 영문 화면의 카드는 영문 상세로 간다. 여기서 접두어를 빠뜨리면 그리드에서
 * 카드 하나를 누른 순간 국문으로 떨어진다. → ADR-031
 */
const link = computed(() =>
  props.to === undefined ? localePath(`/spots/${props.spot.id}`) : props.to,
)

/**
 * 카드에는 영문명을 따로 붙이지 않는다. 한 화면에 49장이 깔리는데 26%만 영문이
 * 붙으면 어떤 카드는 세 줄, 어떤 카드는 두 줄이 되어 격자가 들쭉날쭉해진다.
 * 나란히 두는 자리는 상세 화면과 정류장 카드다. → ADR-030
 */
const name = computed(() => d.name(props.spot))

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

/**
 * 걸어가기엔 먼 곳에는 타고 걸리는 시간을 붙인다.
 *
 * 여기 있던 "버스로 가는 거리"는 왼쪽에 이미 적힌 4.4km를 한 번 더 말할 뿐이었다.
 * 거리는 남겨 둔다 — 그건 잰 값이고, 이건 추정이다. 둘을 나란히 두면
 * 추정이 어디서 나왔는지 읽는 사람이 가늠할 수 있다. → `busMinutes`
 *
 * 기다리는 시간은 들어 있지 않다. 그건 홈의 도착 카드와 상세의 시간표가 답한다.
 */
const rideMinutes = computed(() => busMinutes(props.spot.distance ?? 0))
</script>

<template>
  <component :is="link ? NuxtLink : 'div'" :to="link ?? undefined" class="group block text-left">
    <span class="relative block aspect-square overflow-hidden rounded-md">
      <SpotPhoto :src="spot.imageUrl" :alt="name" />

      <span
        v-if="spot.rank !== null"
        class="absolute left-2.5 top-2.5 w-max rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight shadow-float"
        :class="isTop ? 'bg-primary text-white' : 'bg-white text-ink'"
      >
        {{ t.card.rankBadge(spot.rank) }}
      </span>
    </span>

    <span class="block pt-3">
      <b class="block truncate text-base font-semibold leading-tight">{{ name }}</b>
      <!-- 주소는 국문만 있다. 상류에 영문 주소가 없어 번역하지 않는다. -->
      <span class="mt-0.5 block truncate text-sm text-muted">
        {{ d.category(spot.category)
        }}<template v-if="spot.address"> · {{ shortAddress(spot.address) }}</template>
      </span>
      <span v-if="spot.distance !== undefined" class="mt-1.5 block text-sm text-ink">
        <em class="font-semibold not-italic">{{
          formatDistance(spot.distance, d.locale.value)
        }}</em>
        <template v-if="showWalk"> · {{ t.common.minutesWalk(spot.walkMinutes ?? 0) }}</template>
        <template v-else> · {{ t.card.busRideMinutes(rideMinutes) }}</template>
      </span>
    </span>
  </component>
</template>
