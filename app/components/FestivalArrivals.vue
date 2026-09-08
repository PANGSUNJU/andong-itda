<script setup lang="ts">
import type { ArrivalWithSpots } from '#shared/types/bus'

/**
 * 축제장 정류장의 실시간 도착 — 팝업 안에서만 산다
 *
 * `server: false`인 이유가 둘이다.
 *   1. 이 컴포넌트는 팝업을 연 사람에게만 필요하다. 헤더에 아이콘 하나 띄우자고
 *      모든 페이지의 SSR에 실시간 호출을 얹을 수는 없다.
 *   2. 도착정보는 캐시하지 않는 유일한 엔드포인트다(→ /api/bus/arrivals).
 *      SSR로 구워 보내면 그 순간부터 늙기 시작하는데, 서버에서 보낸 "3분 후"가
 *      화면에 닿을 때 몇 분이 지났는지는 아무도 모른다.
 *
 * 실패해도 팝업이 깨지지 않는다. 축제 정보가 본체고 버스는 그 위에 얹는 것이다.
 */
const props = defineProps<{ stationId: number }>()

const t = useT()

const { data, pending, error } = useFetch<ArrivalWithSpots[]>('/api/bus/arrivals', {
  query: computed(() => ({ stationId: props.stationId })),
  server: false,
  default: () => [],
})

/** 팝업은 좁다. 도착 임박순으로 셋까지만 보여준다. */
const arrivals = computed(() => data.value.slice(0, 3))
</script>

<template>
  <div>
    <p v-if="pending" class="py-3 text-sm text-muted">{{ t.bus.loading }}</p>

    <p v-else-if="error" class="py-3 text-sm text-muted">{{ t.festival.arrivalsError }}</p>

    <!--
      빈 배열은 오류가 아니라 정상 응답이다. 기점 승강장이거나, 배차가 길거나,
      오늘 운행이 끝났을 수 있다. 여기서 그 셋을 가르지 않는다 — 가르려면
      노선의 runTotCnt가 필요하고(→ ADR-015) 그건 관광지 상세가 하는 일이다.
      팝업은 "지금 오는 버스가 있나"까지만 답하고 과장하지 않는다.
    -->
    <p v-else-if="!arrivals.length" class="py-3 text-sm text-muted">
      {{ t.festival.arrivalsEmpty }}
    </p>

    <!-- v-for와 v-else를 한 엘리먼트에 얹지 않는다. Vue 3에서 v-if가 먼저 평가돼 경고가 난다. -->
    <template v-else>
      <ArrivalRow
        v-for="(arrival, index) in arrivals"
        :key="`${arrival.routeNum}-${index}`"
        :route-num="arrival.routeNum"
        :via="arrival.via"
        :route-nm="arrival.routeNm"
        :predict-tm="arrival.predictTm"
        :remain-station="arrival.remainStation"
      />
    </template>
  </div>
</template>
