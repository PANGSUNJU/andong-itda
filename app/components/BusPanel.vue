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
  /** 영문 정류장명. 상류가 전 정류장을 채워 주므로 거의 항상 있다. */
  stationNmEn?: string
  subtitle?: string
  arrivals: ArrivalWithSpots[]
  pending?: boolean
  /**
   * 노선의 기점·종점으로만 쓰이는 승강장. 도착정보가 원리적으로 오지 않는다. → ADR-015
   * 빈 목록의 이유를 "배차가 길어서일 수도"로 덮으면 오지 않을 버스를 기다리게 된다.
   */
  terminusOnly?: boolean
  /** 도착 정보를 마지막으로 받은 시각(ms). SSR에서는 null이다. */
  updatedAt?: number | null
  /** 이 정류장까지 걸어가는 길. 카카오맵으로 넘긴다. */
  directionsUrl?: string
}>()

defineEmits<{ refresh: [] }>()

const t = useT()
const d = useDisplay()

/**
 * 정류장 이름 — 화면 언어 하나만
 *
 * 상류가 2105곳 전부 `stationEngNm`을 채워 주므로 영문 화면에서는 사실상 항상
 * 영문이 나온다. 국문을 아래 덧붙이지 않는다 — 한 화면에는 한 언어다. → ADR-032
 */
const station = computed(() => ({ stationNm: props.stationNm, nameEn: props.stationNmEn }))

const next = computed(() => props.arrivals[0])
const rest = computed(() => props.arrivals.slice(1, 4))

/**
 * 이 버스가 무엇인지 알려주는 한 줄 — 관광지가 먼저, 없으면 방면
 *
 * 둘 다 없으면 빈 문자열이고, 그때는 줄을 통째로 지운다.
 * 예전에는 방면을 모를 때 `via`를 그대로 뱉어 "청호한우촌앞 -> · 11정거장 전"이 됐다.
 * 화살표 뒤가 비어 있는 건 상류가 종점을 안 주기 때문이다. → `formatDirection`
 */
const nextHeadline = computed(() => {
  const arrival = next.value
  if (!arrival) return ''
  // 관광지 이름은 노선 문자열에서 온 국문 지명이라 영문 상대가 없다. → ADR-025
  return arrival.spots.length
    ? t.value.bus.takesYouTo(arrival.spots.map((spot) => spot.name).join(' · '))
    : formatDirection(arrival.via, arrival.routeNm, d.locale.value)
})

/**
 * 놓쳤을 때를 위한 같은 노선의 다음 차
 *
 * 정류장에는 여러 노선이 서므로 아래 목록의 다음 줄은 대개 **다른 노선**이다.
 * "이 버스를 놓치면 얼마나 기다리나"에 답하려면 같은 번호를 찾아야 한다.
 * 목록은 이미 도착 임박순이라 앞에서부터 첫 번째로 만나는 같은 번호가 그 차다.
 * 없으면(대부분) 아무것도 말하지 않는다. 배차 간격을 추측해 채우지 않는다.
 */
const nextSameRoute = computed(() =>
  next.value
    ? props.arrivals
        .slice(1)
        .find((arrival) => arrival.routeNum === next.value!.routeNum && arrival.predictTm !== null)
    : undefined,
)
</script>

<template>
  <section class="rounded-md border border-hairline p-6 shadow-float">
    <div
      class="flex items-start justify-between gap-3 border-b border-hairline-soft pb-4"
    >
      <div class="min-w-0">
        <b class="block truncate text-base font-semibold leading-tight">
          {{ d.stationName(station) }}
        </b>
        <!-- 이름은 지금 화면의 언어 하나만 둔다. 반대편 언어를 겹쳐 쓰지 않는다. → ADR-032 -->
        <small v-if="subtitle" class="mt-0.5 block text-sm text-muted">{{ subtitle }}</small>

        <!--
          여기까지 걸어가는 길. 이름이 같은 승강장이 셋이라 글로는 끝까지 못 데려다준다.
          목적지 좌표를 그대로 넘기므로 어느 승강장인지가 정확히 전달된다.
        -->
        <a
          v-if="directionsUrl"
          :href="directionsUrl"
          target="_blank"
          rel="noopener"
          class="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary underline"
        >
          {{ t.bus.directionsToStop }}
        </a>
      </div>

      <!-- 기·종점 승강장에는 실시간이랄 게 없다. 뛰는 점을 보여주면 기다리게 된다. -->
      <RealtimeBadge
        v-if="!terminusOnly"
        :updated-at="updatedAt ?? null"
        :pending="pending"
        @refresh="$emit('refresh')"
      />
    </div>

    <div v-if="pending" class="py-10 text-center text-sm text-muted">{{ t.bus.loading }}</div>

    <template v-else-if="next">
      <div class="pb-4 pt-6 text-center">
        <div class="flex items-baseline justify-center gap-1.5">
          <b class="text-arrival">{{ next.predictTm ?? '—' }}</b>
          <em class="text-2xl font-semibold not-italic">{{
            next.predictTm !== null ? t.common.minuteUnit : ''
          }}</em>
        </div>
        <h2 class="mt-2 text-base font-semibold leading-tight">
          {{
            next.predictTm !== null
              ? t.bus.arrivingSoon(next.routeNum)
              : t.bus.onTheWay(next.routeNum)
          }}
        </h2>
        <!--
          닿는 관광지가 방향을 대신한다. 홈에서 "지금 오는 버스가 어디로 가나"에
          답하는 자리다. 방향(via의 종점)을 함께 쓰면 같은 이름이 두 번 나온다 —
          매핑된 관광지가 대부분 그 노선의 종점이기 때문이다. → ADR-025

          관광지를 판정하지 못하면 방향으로 되돌아간다. 줄이 통째로 사라지면
          이 버스가 무엇인지 말해주는 정보가 노선번호밖에 남지 않는다.
        -->
        <p
          v-if="nextHeadline || next.remainStation !== null"
          class="mt-1 text-sm"
          :class="next.spots.length ? 'font-medium text-primary' : 'text-muted'"
        >
          {{ nextHeadline }}
          <span v-if="next.remainStation !== null" class="font-normal text-muted">
            <!-- 앞 문구가 없으면 구분점도 없다. 점만 남으면 그게 오류로 보인다. -->
            <template v-if="nextHeadline">· </template>{{ t.common.stopsAway(next.remainStation) }}
          </span>
        </p>

        <!-- 놓쳐도 되는지 아닌지가 여기서 갈린다. 같은 번호의 다음 차만 말한다. -->
        <p v-if="nextSameRoute" class="mt-2 text-[13px] text-muted-soft">
          {{ t.bus.nextSameRoute(nextSameRoute.routeNum, nextSameRoute.predictTm!) }}
        </p>
      </div>

      <ArrivalRow
        v-for="arrival in rest"
        :key="`${arrival.routeId}-${arrival.stationOrd}`"
        :route-num="arrival.routeNum"
        :via="arrival.via"
        :route-nm="arrival.routeNm"
        :predict-tm="arrival.predictTm"
        :remain-station="arrival.remainStation"
        :spots="arrival.spots"
      />
    </template>

    <!--
      도착이 없는 이유를 이 화면은 알 수 없다. 단정하지 않고 사실만 적는다.
      단 하나, 기·종점 전용 승강장은 원리적으로 안 오는 것이라 그건 말할 수 있다.
    -->
    <div v-else class="py-10 text-center">
      <template v-if="terminusOnly">
        <p class="text-base font-medium">{{ t.bus.terminusTitle }}</p>
        <p class="mt-1.5 text-sm leading-relaxed text-muted">
          {{ t.bus.terminusBody1 }}<br />
          {{ t.bus.terminusBody2 }}
        </p>
      </template>

      <template v-else>
        <p class="text-base font-medium">{{ t.bus.emptyTitle }}</p>
        <p class="mt-1.5 text-sm leading-relaxed text-muted">
          {{ t.bus.emptyBody1 }}<br />
          {{ t.bus.emptyBody2 }}
        </p>
      </template>
    </div>
  </section>
</template>
