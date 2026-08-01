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
const props = defineProps<{ info: SpotBusInfo }>()

const next = computed(() => props.info.inbound?.arrivals[0])
const rest = computed(() => props.info.inbound?.arrivals.slice(1, 4) ?? [])

/** 화면 문구는 status에서만 갈린다. */
const statusText = computed(() => {
  switch (props.info.status) {
    case 'arriving':
      return null
    case 'waiting':
      return {
        title: '접근 중인 버스가 없어요',
        body: '노선은 운행 중이에요. 배차 간격이 길어 기다리면 옵니다.',
        tone: 'muted' as const,
      }
    default:
      return {
        title: '오늘 이 노선 운행이 끝났어요',
        body: '아래 시간표에서 첫차 시각을 확인하세요.',
        tone: 'warn' as const,
      }
  }
})
</script>

<template>
  <section class="rounded-md border border-hairline p-6 shadow-float">
    <div class="flex items-start justify-between gap-3 border-b border-hairline-soft pb-4">
      <div class="min-w-0">
        <b class="block truncate text-base font-semibold leading-tight">
          {{ info.inbound?.stationNm ?? '정류장 미확인' }}
        </b>
        <small class="mt-0.5 block text-sm text-muted">시내에서 들어오는 편</small>
      </div>
      <span
        v-if="info.status === 'arriving'"
        class="flex flex-none items-center gap-1.5 text-[13px] font-medium text-primary"
      >
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        실시간
      </span>
    </div>

    <!-- 도착이 있을 때만 큰 숫자를 쓴다 -->
    <template v-if="next">
      <div class="pb-4 pt-6 text-center">
        <div class="flex items-baseline justify-center gap-1.5">
          <b class="text-arrival">{{ next.predictTm ?? '—' }}</b>
          <em class="text-2xl font-semibold not-italic">{{
            next.predictTm !== null ? '분' : ''
          }}</em>
        </div>
        <h2 class="mt-2 text-base font-semibold leading-tight">
          {{ next.routeNum }}번이 오고 있어요
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ formatDirection(next.via) }}
          <template v-if="next.remainStation !== null">
            · {{ next.remainStation }}정거장 전
          </template>
        </p>
      </div>

      <ArrivalRow
        v-for="(arrival, index) in rest"
        :key="`${arrival.routeNum}-${index}`"
        :route-num="arrival.routeNum"
        :via="arrival.via"
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

    <!-- 시간표. 서버가 준 값만 쓰고 없는 값은 만들지 않는다. -->
    <dl class="border-t border-hairline-soft pt-4 text-sm">
      <div v-if="info.schedule.departFirst" class="flex justify-between py-1.5">
        <dt class="text-muted">{{ info.schedule.outboundFrom ?? '시내' }} 출발</dt>
        <dd class="font-medium">
          첫차 {{ info.schedule.departFirst }} · 막차 {{ info.schedule.departLast }}
        </dd>
      </div>
      <div v-if="info.schedule.runs" class="flex justify-between py-1.5">
        <dt class="text-muted">하루 운행</dt>
        <dd class="font-medium">{{ info.schedule.runs }}회</dd>
      </div>
      <div v-if="info.schedule.returnTimesKnown" class="flex justify-between py-1.5">
        <dt class="text-muted">돌아오는 편</dt>
        <dd class="font-medium">
          첫차 {{ info.schedule.returnFirst }} · 막차 {{ info.schedule.returnLast }}
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
      <b class="font-semibold">돌아오는 편 시간표는 공식 자료에 없어요.</b><br />
      {{ info.schedule.note ?? '현장에서 기사님께 막차 시각을 확인하세요.' }}
    </p>

    <p v-if="info.warning" class="mt-3 text-[13px] leading-relaxed text-primary">
      {{ info.warning }}
    </p>

    <p class="mt-3 text-[13px] leading-relaxed text-muted">{{ info.outbound.reason }}</p>
  </section>
</template>
