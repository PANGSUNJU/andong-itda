<script setup lang="ts">
import type { SpotRouteInfo } from '#shared/types/static-data'

/**
 * 노선 안내 — 44곳 전부가 "어느 버스를 타면 되는가"에 답한다
 *
 * 실시간 도착 카드(`SpotBusPanel`)는 사람이 확인한 승강장 7곳에만 뜬다. 나머지
 * 37곳은 "버스 정보가 등록되지 않은 곳이에요" 한 줄이 전부였다. 그런데 그 화면이
 * 제안서가 밝힌 차별성 자체다(교통과 관광을 한 화면에 → ADR-012).
 *
 * 이 카드는 다른 질문에 답해서 그 구멍을 메운다.
 *
 *   실시간 카드  "지금 몇 분 후에 오는가"  — 승강장을 확정해야 답할 수 있다
 *   이 카드      "어느 버스를 타면 오는가"  — 노선만 알면 답할 수 있다
 *
 * 승강장을 고르지 않으므로 같은 이름의 쌍둥이 승강장 문제를 비켜간다(44곳 중
 * 30곳이 그렇다). 시간과도 무관해서, 막차가 끊긴 새벽에 열어도 화면이 비지 않는다.
 * → `server/utils/spotRoutes.ts`
 */
const props = defineProps<{ info: SpotRouteInfo }>()

const t = useT()
const d = useDisplay()

/** 하나라도 돌고 있으면 "운행 중"이다. */
const anyRunning = computed(() =>
  [...props.info.inbound, ...props.info.outbound].some((route) => route.runTotCnt > 0),
)

/**
 * 전부 0일 때 뜻이 갈린다 — 이 노선만 안 도는가, 안동 전체가 멈췄는가.
 *
 * 옆에 뜨는 실시간 카드와 같은 신호(`fleetRunning`)를 본다. 다른 근거를 쓰면
 * 같은 화면의 두 카드가 서로 다른 말을 하는 날이 온다. → ADR-036
 */
const badge = computed(() => {
  if (anyRunning.value) return { text: t.value.spotRoutes.running, live: true }
  return props.info.fleetRunning
    ? { text: t.value.spotRoutes.idleRoute, live: false }
    : { text: t.value.spotRoutes.offHours, live: false }
})

const hasRoutes = computed(() => props.info.inbound.length > 0 || props.info.outbound.length > 0)

/** 돌아오는 편은 번호만 말한다. 하차 정류장·정거장 수는 갈 때와 대칭이라 두 번 쓸 이유가 없다. */
const outboundNums = computed(() => [...new Set(props.info.outbound.map((r) => r.routeNum))])
</script>

<template>
  <section class="rounded-md border border-hairline p-6">
    <div class="flex items-center justify-between gap-3 border-b border-hairline-soft pb-3">
      <b class="text-base font-semibold leading-tight">{{ t.spotRoutes.head }}</b>
      <!--
        운행 상태를 노선 목록 옆에 둔다. 밤에 열어본 사람에게 "이 버스가 오늘은
        이미 끊겼다"는 사실이 노선 번호만큼 중요하다. → ADR-015의 runTotCnt 판단
      -->
      <small
        v-if="hasRoutes"
        class="flex-none rounded-full px-2.5 py-1 text-xs font-medium"
        :class="badge.live ? 'bg-primary/10 text-primary' : 'bg-surface-soft text-muted'"
      >
        {{ badge.text }}
      </small>
    </div>

    <template v-if="info.inbound.length">
      <p class="pt-4 text-sm font-medium text-muted">{{ t.spotRoutes.inboundHead }}</p>

      <ul class="mt-1">
        <li
          v-for="route in info.inbound"
          :key="route.routeId"
          class="flex items-start gap-3 border-b border-hairline-soft py-3 last:border-b-0"
        >
          <!-- 노선 번호가 이 카드의 답이다. 가장 크게 둔다. -->
          <b class="flex-none text-base font-semibold leading-tight">
            {{ t.spotRoutes.routeLabel(route.routeNum) }}
          </b>
          <span class="min-w-0 flex-1">
            <!--
              정류장 이름은 상류가 영문을 채워 주므로 화면 언어를 따른다.
              관광지 이름이 26%만 영문인 것과 대조적이다. → ADR-030
            -->
            <span class="block text-sm leading-tight text-body">
              {{ t.spotRoutes.getOff(d.stationName({ stationNm: route.stationNm, nameEn: route.stationNmEn })) }}
            </span>
            <span class="mt-0.5 block text-[13px] text-muted">
              {{ t.spotRoutes.ride(route.stops, formatDistance(route.roadMeters, d.locale.value)) }}
              ·
              {{ t.spotRoutes.thenWalk(formatDistance(route.walkMeters, d.locale.value)) }}
            </span>
          </span>
        </li>
      </ul>

      <p v-if="info.inboundTotal > info.inbound.length" class="mt-2 text-[13px] text-muted-soft">
        {{ t.spotRoutes.more(info.inboundTotal - info.inbound.length) }}
      </p>

      <!--
        돌아오는 편을 반드시 붙인다. 이 서비스에서 가장 위험한 실패는 "갈 수는
        있는데 못 돌아오는" 안내다. → ADR-016
      -->
      <p v-if="outboundNums.length" class="mt-4 text-sm leading-relaxed text-body">
        <span class="text-muted">{{ t.spotRoutes.outboundHead }}</span>
        <b class="ml-2 font-medium">
          {{ outboundNums.map((num) => t.spotRoutes.routeLabel(num)).join(' · ') }}
        </b>
      </p>
    </template>

    <!-- 정류장은 있는데 노선이 시내와 안 닿는다. 빈 목록과 뜻이 다르므로 따로 말한다. -->
    <div v-else-if="info.disconnected" class="mt-4 rounded-sm bg-surface-soft px-4 py-4">
      <p class="text-sm font-medium">{{ t.spotRoutes.disconnectedTitle }}</p>
      <p class="mt-1 text-[13px] leading-relaxed text-muted">{{ t.spotRoutes.disconnectedBody }}</p>
    </div>

    <div v-else class="mt-4 rounded-sm bg-surface-soft px-4 py-4">
      <p class="text-sm font-medium">{{ t.spotRoutes.noneTitle }}</p>
      <p class="mt-1 text-[13px] leading-relaxed text-muted">{{ t.spotRoutes.noneBody }}</p>
    </div>

    <!-- 근거를 밝힌다. 사람이 확인한 매핑과 같은 무게로 읽히면 안 된다. -->
    <p class="mt-4 text-[13px] leading-relaxed text-muted-soft">{{ t.spotRoutes.note }}</p>
  </section>
</template>
