<script setup lang="ts">
import type { ArrivalForDestination } from '#shared/types/bus'

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
  /**
   * 도착 목록. 목적지를 정했으면 **목적지행이 앞으로 정렬되어** 온다.
   * 거르지는 않는다 — 배차가 드문 노선에서 거르면 화면이 자주 빈다.
   */
  arrivals: ArrivalForDestination[]
  /** 목적지 이름. 정했을 때만 온다. 표와 안내 문구가 이 값을 쓴다. */
  destination?: string
  /**
   * 지금 출발하면 목적지까지 총 몇 분. 목적지행 차가 실제로 오고 있을 때만 온다.
   * 셋을 따로 받는 이유는 화면에 쪼개서 적기 위해서다 — 어디까지가 잰 값인지
   * 읽는 사람이 알아야 한다. → `index.vue`의 `trip`
   */
  trip?: { wait: number; ride: number; walk: number; total: number } | null
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

/**
 * "곧 도착"이라고 말해도 되는 한계 — 3분
 *
 * 이 문구가 12분짜리 도착 위에도 붙어 있었다. 큰 숫자는 `12`인데 그 아래에서
 * "곧 도착해요"라고 말하면 문장이 자기 화면의 숫자와 어긋난다. 3분을 넘으면
 * 시각을 주장하지 않는 `onTheWay`("오고 있어요")로 돌아간다 — 그건 12분에도
 * 참이고, 도착 예정 시각을 못 받았을 때(`predictTm === null`)에도 참이다.
 */
const ARRIVING_SOON_MIN = 3

const isArrivingSoon = computed(() => {
  const minutes = next.value?.predictTm
  return minutes != null && minutes <= ARRIVING_SOON_MIN
})

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

/**
 * 큰 숫자 아래의 목록 — 위에서 이미 말한 차는 빼고 센다
 *
 * `nextSameRoute`("다음 211번은 17분 후예요")가 목록 첫 줄에 `211 · 17분`으로
 * 한 번 더 나오고 있었다. 같은 버스가 한 화면에 두 번 적히면 읽는 사람은 그것을
 * 두 대로 읽는다. 문장으로 말한 차를 목록에서 빼면 세 줄이 서로 다른 노선이 된다.
 *
 * ⚠️ 걸러낸 **다음에** 세 줄을 센다. 자르고 나서 빼면 줄 수가 들쭉날쭉해진다.
 */
const rest = computed(() =>
  props.arrivals
    .slice(1)
    .filter((arrival) => arrival !== nextSameRoute.value)
    .slice(0, 3),
)

/**
 * 목적지를 정했는데 지금 오는 차 중에 그리로 가는 게 하나도 없는 상태
 *
 * 흔한 상태다. 안동 외곽 노선은 배차가 하루 3~13회라 "지금은 없다"가 기본값에
 * 가깝다. 그래서 목록을 지우지 않고 이 한 줄만 덧붙인다 — 지금 오는 차가
 * 무엇인지는 그것대로 알아야 하기 때문이다.
 *
 * `toDestination`이 `undefined`인 목록(목적지 미지정)에서는 뜨지 않는다.
 */
const noneBound = computed(
  () =>
    Boolean(props.destination) &&
    props.arrivals.length > 0 &&
    !props.arrivals.some((arrival) => arrival.toDestination),
)

/**
 * 큰 숫자가 가리키는 **그 차**가 목적지행인가
 *
 * 히어로의 분기를 이 값 하나가 가른다. 목적지행일 때는 "이 차가 무엇인가" 슬롯이
 * 목적지 이야기로 **바뀐다** — 더해지지 않는다. 그래서 목적지가 없을 때의 마크업은
 * 한 글자도 달라지지 않는다. → ADR-051
 */
const bound = computed(() => Boolean(props.destination) && Boolean(next.value?.toDestination))

/**
 * 합계는 **큰 숫자와 같은 차일 때만** 쓴다
 *
 * ⚠️ `index.vue`의 `trip`은 "목적지행이면서 도착 예정을 받은 첫 차"로 계산된다.
 *    `next`가 목적지행인데 `predictTm`이 null이면 그 합계는 **뒤쪽 다른 차의 값**이다.
 *    두 줄로 나뉘어 있을 때는 그 어긋남이 가려졌지만, "○○까지 약 44분" 한 문장으로
 *    합치면 큰 숫자 `—` 옆에서 정면으로 드러난다. 여기서 끊는다.
 */
const boundTrip = computed(() =>
  bound.value && next.value?.predictTm !== null ? (props.trip ?? null) : null,
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
          {{ isArrivingSoon ? t.bus.arrivingSoon(next.routeNum) : t.bus.onTheWay(next.routeNum) }}
        </h2>

        <!--
          목적지 줄 — 배지와 합계를 한 문장으로 합쳤다.

          예전에는 알약 배지("○○ 방면")와 합계("지금 출발하면 약 44분")가 두 줄이었다.
          둘 다 목적지 이야기라 같은 말을 두 번 한 셈이다. 이름을 문장 안에 넣으면
          "이 차가 목적지행"이라는 사실은 문구가, 위계는 굵기와 primary가 말한다.
          알약은 한 겹 더 그린 상자였을 뿐이다. → ADR-051

          합계를 못 냈을 때(`boundTrip`이 null)는 목적지 이름만 말한다. 그래도
          "목적지행"이라는 사실은 남는다.
        -->
        <p
          v-if="bound && destination"
          class="mt-2 text-base font-semibold leading-tight text-primary"
        >
          {{
            boundTrip
              ? t.home.tripToDestination(destination, boundTrip.total)
              : t.home.destinationBound(destination)
          }}
        </p>

        <!--
          목적지행이 **아닐 때**의 줄 — 오늘과 완전히 같다.

          닿는 관광지가 방향을 대신한다. 홈에서 "지금 오는 버스가 어디로 가나"에
          답하는 자리다. 방향(via의 종점)을 함께 쓰면 같은 이름이 두 번 나온다 —
          매핑된 관광지가 대부분 그 노선의 종점이기 때문이다. → ADR-025

          ⚠️ 위 목적지 줄이 이 슬롯을 **대체한다**(`v-else-if`). 나란히 두면
             "○○까지 약 44분" 아래 "교보생명 방면"이 붙어, 이미 답이 난 물음에
             다시 답한다.
        -->
        <p
          v-else-if="nextHeadline || next.remainStation !== null"
          class="mt-1 text-sm"
          :class="next.spots.length ? 'font-medium text-primary' : 'text-muted'"
        >
          {{ nextHeadline }}
          <span v-if="next.remainStation !== null" class="font-normal text-muted">
            <!-- 앞 문구가 없으면 구분점도 없다. 점만 남으면 그게 오류로 보인다. -->
            <template v-if="nextHeadline">· </template>{{ t.common.stopsAway(next.remainStation) }}
          </span>
        </p>

        <!--
          근거 줄 — 위 한 문장이 어디서 나왔는지. 목적지 줄이 떴을 때만 있다.

          ⚠️ `22정거장 전`을 위 줄에 붙이지 않는다. "○○까지 약 44분 · 22정거장 전"은
             두 숫자가 나란해서 **22를 목적지까지의 정거장으로 읽게 된다.** 실제로는
             이 버스가 지금 어디쯤인가이고, 곧 `기다리기 18분`의 근거다. 그래서
             내역의 맨 앞에 둔다.

          내역을 지우지 않는 이유는 그대로다 — 셋 중 기다리는 시간만 잰 값이고
          나머지는 우리가 민 추정이라, 합계만 두면 어디까지 믿을 값인지 알 수 없다.
        -->
        <p
          v-if="bound && (boundTrip || next.remainStation !== null)"
          class="mt-1 text-[13px] leading-relaxed text-muted"
        >
          <template v-if="next.remainStation !== null">{{
            t.common.stopsAway(next.remainStation)
          }}</template>
          <template v-if="next.remainStation !== null && boundTrip"> · </template>
          <template v-if="boundTrip">{{
            boundTrip.walk > 0
              ? t.home.tripBreakdown(boundTrip.wait, boundTrip.ride, boundTrip.walk)
              : t.home.tripBreakdownNoWalk(boundTrip.wait, boundTrip.ride)
          }}</template>
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
        :destination-bound="
          arrival.toDestination && destination ? t.home.destinationBound(destination) : undefined
        "
      />

      <!--
        목록을 지우지 않았으므로 "없다"는 사실은 따로 적어야 한다.
        이 줄이 없으면 목적지를 정한 사람이 위의 목록을 전부 목적지행으로 읽는다.
      -->
      <p
        v-if="noneBound && destination"
        class="border-t border-hairline-soft pt-3 text-[13px] leading-relaxed text-muted"
      >
        {{ t.home.destinationNotArriving(destination) }}
      </p>
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
