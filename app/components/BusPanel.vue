<script setup lang="ts">
import type { ArrivalWithSpots } from '#shared/types/bus'

/**
 * 정류장 도착 카드 — 홈의 앵커
 *
 * 이 화면에서 큰 타이포를 쓰는 곳은 여기 하나뿐이다. "몇 분 후"가
 * 여행자가 이 서비스를 켠 이유이므로, 그 숫자만 크게 둔다.
 *
 * ⚠️ 도착이 없을 때 "오늘 운행이 끝났어요"라고 쓰지 않는다.
 *    그 판정에는 노선의 runTotCnt가 필요한데, 정류장에는 여러 노선이 서므로
 *    정류장 단위로는 알 수 없다. 관광지 화면(/api/spot-bus)만이 노선을
 *    특정할 수 있어 그 판정을 내릴 수 있다. → ADR-015
 */
const props = defineProps<{
  stationNm: string
  subtitle?: string
  arrivals: ArrivalWithSpots[]
  pending?: boolean
}>()

const next = computed(() => props.arrivals[0])
const rest = computed(() => props.arrivals.slice(1, 4))
</script>

<template>
  <section class="rounded-md border border-hairline p-6 shadow-float">
    <div
      class="flex items-start justify-between gap-3 border-b border-hairline-soft pb-4"
    >
      <div class="min-w-0">
        <b class="block truncate text-base font-semibold leading-tight">{{ stationNm }}</b>
        <small v-if="subtitle" class="mt-0.5 block text-sm text-muted">{{ subtitle }}</small>
      </div>
      <span class="flex flex-none items-center gap-1.5 text-[13px] font-medium text-primary">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        실시간
      </span>
    </div>

    <div v-if="pending" class="py-10 text-center text-sm text-muted">도착 정보를 불러오는 중…</div>

    <template v-else-if="next">
      <div class="pb-4 pt-6 text-center">
        <div class="flex items-baseline justify-center gap-1.5">
          <b class="text-arrival">{{ next.predictTm ?? '—' }}</b>
          <em class="text-2xl font-semibold not-italic">{{
            next.predictTm !== null ? '분' : ''
          }}</em>
        </div>
        <h2 class="mt-2 text-base font-semibold leading-tight">
          {{ next.routeNum }}번이 {{ next.predictTm !== null ? '곧 도착해요' : '오고 있어요' }}
        </h2>
        <!--
          닿는 관광지가 방향을 대신한다. 홈에서 "지금 오는 버스가 어디로 가나"에
          답하는 자리다. 방향(via의 종점)을 함께 쓰면 같은 이름이 두 번 나온다 —
          매핑된 관광지가 대부분 그 노선의 종점이기 때문이다. → ADR-025

          관광지를 판정하지 못하면 방향으로 되돌아간다. 줄이 통째로 사라지면
          이 버스가 무엇인지 말해주는 정보가 노선번호밖에 남지 않는다.
        -->
        <p
          class="mt-1 text-sm"
          :class="next.spots.length ? 'font-medium text-primary' : 'text-muted'"
        >
          {{
            next.spots.length
              ? `타면 ${next.spots.map((spot) => spot.name).join(' · ')}에 가요`
              : formatDirection(next.via)
          }}
          <span v-if="next.remainStation !== null" class="font-normal text-muted">
            · {{ next.remainStation }}정거장 전
          </span>
        </p>
      </div>

      <ArrivalRow
        v-for="arrival in rest"
        :key="`${arrival.routeId}-${arrival.stationOrd}`"
        :route-num="arrival.routeNum"
        :via="arrival.via"
        :predict-tm="arrival.predictTm"
        :remain-station="arrival.remainStation"
        :spots="arrival.spots"
      />
    </template>

    <!-- 도착이 없는 이유를 이 화면은 알 수 없다. 단정하지 않고 사실만 적는다. -->
    <div v-else class="py-10 text-center">
      <p class="text-base font-medium">지금 이 정류장으로 접근 중인 버스가 없어요</p>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        배차 간격이 길어서일 수도, 오늘 운행이 끝나서일 수도 있어요.<br />
        다른 정류장을 확인해 보세요.
      </p>
    </div>
  </section>
</template>
