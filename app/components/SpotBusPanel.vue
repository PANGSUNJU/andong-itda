<script setup lang="ts">
import type { SpotBusInfo } from '#shared/types/static-data'

/**
 * 관광지 버스 카드 — 이 서비스의 차별점이 실제로 구현되는 자리
 *
 * 관광 정보와 교통 정보를 한 화면에 둔다. 기존 안동 서비스들은 둘이 분리되어
 * 여행자가 앱을 오갔다. → ADR-012
 *
 * ⚠️ 배지는 status로만 정한다. isOperating으로 정하면 안 된다.
 *    정류장에는 여러 노선이 서므로 "이 노선은 운행 종료(isOperating=false)"인데
 *    "다른 노선 버스가 접근 중(status='arriving')"인 상태가 동시에 성립한다.
 *    그때 '운행 종료'를 띄우면, 눈앞에 오고 있는 버스를 두고 없다고 말하게 된다.
 */
const props = defineProps<{
  info: SpotBusInfo
  /** 도착 정보를 마지막으로 받은 시각(ms). SSR에서는 null이다. */
  updatedAt?: number | null
  pending?: boolean
}>()

defineEmits<{ refresh: [] }>()

const t = useT()
const d = useDisplay()

/** 정류장 이름. 상류가 영문을 채워 주므로 두 언어가 나란히 선다. → ADR-030 */
const station = computed(() => ({
  stationNm: props.info.inbound?.stationNm ?? '',
  nameEn: props.info.inbound?.stationNmEn,
}))

const next = computed(() => props.info.inbound?.arrivals[0])
const rest = computed(() => props.info.inbound?.arrivals.slice(1, 4) ?? [])

/** 방면. 상류 via의 종점이 비어 오면 routeNm에서 건진다. 둘 다 없으면 줄을 지운다. */
const direction = computed(() =>
  next.value ? formatDirection(next.value.via, next.value.routeNm, d.locale.value) : '',
)

/** 놓쳤을 때를 위한 같은 노선의 다음 차. 목록이 도착 임박순이라 첫 일치가 그 차다. */
const nextSameRoute = computed(() =>
  next.value
    ? props.info.inbound?.arrivals
        .slice(1)
        .find((arrival) => arrival.routeNum === next.value!.routeNum && arrival.predictTm !== null)
    : undefined,
)

/** 화면 문구는 status에서만 갈린다. */
const statusText = computed(() => {
  switch (props.info.status) {
    case 'arriving':
      return null
    case 'waiting':
      return {
        title: t.value.bus.waitingTitle,
        body: t.value.bus.waitingBody,
        tone: 'muted' as const,
      }
    default:
      return {
        title: t.value.bus.closedTitle,
        body: t.value.bus.closedBody,
        tone: 'warn' as const,
      }
  }
})

/**
 * 정적 데이터의 문장 — 영문이 있으면 영문, 없으면 국문
 *
 * 한계를 밝히는 문장이라(ADR-016) 영문 화면에서 빠지면 안 되는 것들이다.
 * 번역이 비어 있으면 국문이라도 남긴다. 지우는 것이 가장 나쁘다.
 */
const note = computed(() => d.pick(props.info.schedule.note, props.info.schedule.noteEn))
const warning = computed(() => d.pick(props.info.warning, props.info.warningEn))
const outboundReason = computed(() => d.pick(props.info.outbound.reason, props.info.outbound.reasonEn))
</script>

<template>
  <section class="rounded-md border border-hairline p-6 shadow-float">
    <div class="flex items-start justify-between gap-3 border-b border-hairline-soft pb-4">
      <div class="min-w-0">
        <b class="block truncate text-base font-semibold leading-tight">
          {{ info.inbound ? d.stationName(station) : t.bus.stationUnknown }}
        </b>
        <!-- 이름은 지금 화면의 언어 하나만 둔다. 반대편 언어를 겹쳐 쓰지 않는다. → ADR-032 -->
        <small class="mt-0.5 block text-sm text-muted">{{ t.bus.inboundFromDowntown }}</small>
      </div>
      <!--
        도착이 없을 때도 배지를 남긴다. 예전에는 `status === 'arriving'`일 때만 띄웠는데,
        정작 다시 확인하고 싶은 순간은 "접근 중인 버스가 없어요"를 봤을 때다.
        새로고침이 그 배지에 붙어 있으므로 그때 사라지면 안 된다.
      -->
      <RealtimeBadge
        :updated-at="updatedAt ?? null"
        :pending="pending"
        @refresh="$emit('refresh')"
      />
    </div>

    <!-- 도착이 있을 때만 큰 숫자를 쓴다 -->
    <template v-if="next">
      <div class="pb-4 pt-6 text-center">
        <div class="flex items-baseline justify-center gap-1.5">
          <b class="text-arrival">{{ next.predictTm ?? '—' }}</b>
          <em class="text-2xl font-semibold not-italic">{{
            next.predictTm !== null ? t.common.minuteUnit : ''
          }}</em>
        </div>
        <h2 class="mt-2 text-base font-semibold leading-tight">
          {{ t.bus.onTheWay(next.routeNum) }}
        </h2>
        <p v-if="direction || next.remainStation !== null" class="mt-1 text-sm text-muted">
          {{ direction }}
          <template v-if="next.remainStation !== null">
            <!-- 앞 문구가 없으면 구분점도 없다. 점만 남으면 그게 오류로 보인다. -->
            <template v-if="direction">· </template>{{ t.common.stopsAway(next.remainStation) }}
          </template>
        </p>

        <!-- 놓쳐도 되는지가 여기서 갈린다. 같은 번호의 다음 차만 말한다. -->
        <p v-if="nextSameRoute" class="mt-2 text-[13px] text-muted-soft">
          {{ t.bus.nextSameRoute(nextSameRoute.routeNum, nextSameRoute.predictTm!) }}
        </p>
      </div>

      <ArrivalRow
        v-for="(arrival, index) in rest"
        :key="`${arrival.routeNum}-${index}`"
        :route-num="arrival.routeNum"
        :via="arrival.via"
        :route-nm="arrival.routeNm"
        :predict-tm="arrival.predictTm"
        :remain-station="arrival.remainStation"
      />
    </template>

    <div
      v-else-if="statusText"
      class="my-4 rounded-sm px-4 py-5 text-center"
      :class="statusText.tone === 'warn' ? 'bg-primary/5' : 'bg-surface-soft'"
    >
      <p class="text-base font-medium" :class="statusText.tone === 'warn' ? 'text-primary' : ''">
        {{ statusText.title }}
      </p>
      <p class="mt-1 text-sm leading-relaxed text-muted">{{ statusText.body }}</p>
    </div>

    <!--
      시간표. 서버가 준 값만 쓰고 없는 값은 만들지 않는다.
      출발지(outboundFrom)는 상류 시간표의 정류장명이라 국문 그대로 나간다.
    -->
    <dl class="border-t border-hairline-soft pt-4 text-sm">
      <div v-if="info.schedule.departFirst" class="flex justify-between py-1.5">
        <dt class="text-muted">
          {{ t.bus.departsFrom(info.schedule.outboundFrom ?? t.bus.downtown) }}
        </dt>
        <dd class="font-medium">
          {{ t.bus.firstLast(info.schedule.departFirst, info.schedule.departLast ?? '—') }}
        </dd>
      </div>
      <div v-if="info.schedule.runs" class="flex justify-between py-1.5">
        <dt class="text-muted">{{ t.bus.runsPerDay }}</dt>
        <dd class="font-medium">{{ t.bus.runsCount(info.schedule.runs) }}</dd>
      </div>
      <div v-if="info.schedule.returnTimesKnown" class="flex justify-between py-1.5">
        <dt class="text-muted">{{ t.bus.returnTrip }}</dt>
        <dd class="font-medium">
          {{ t.bus.firstLast(info.schedule.returnFirst ?? '—', info.schedule.returnLast ?? '—') }}
        </dd>
      </div>
    </dl>

    <!--
      귀로 시각을 모를 때 추정치를 막차처럼 보여주지 않는다.
      틀린 막차 정보는 여행자를 밤에 정류장에 세워둔다. → ADR-016
    -->
    <p
      v-if="!info.schedule.returnTimesKnown"
      class="mt-3 rounded-sm bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-body"
    >
      <b class="font-semibold">{{ t.bus.returnUnknownStrong }}</b><br />
      {{ note ?? t.bus.returnUnknownFallback }}
    </p>

    <p v-if="warning" class="mt-3 text-[13px] leading-relaxed text-primary">
      {{ warning }}
    </p>

    <p class="mt-3 text-[13px] leading-relaxed text-muted">{{ outboundReason }}</p>
  </section>
</template>
