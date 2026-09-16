<script setup lang="ts">
import type { SpotRouteOption, SpotTimetable } from '#shared/types/static-data'

/**
 * 목적지의 돌아오는 편 · 막차 — 홈에서 "가서 돌아올 수 있나"에 답한다
 *
 * 이 서비스에서 가장 위험한 실패가 **"갈 수는 있는데 못 돌아오는"** 안내다(ADR-016).
 * 그 판단을 상세 화면까지 들어가야 볼 수 있게 두면, 홈에서 목적지를 정하고 버스에
 * 오른 사람은 그 사실을 모른 채 떠난다. 그래서 목적지를 정하면 홈에도 붙인다.
 *
 * ⚠️ **데이터가 성긴 자리다.** 실측(2026-09-16):
 *
 *    가는 편 막차      44곳 중 5곳 (사람이 확인한 7곳 중 5곳)
 *    돌아오는 편 시각  44곳 중 2곳 (도산서원·만휴정)
 *    돌아오는 편 노선  44곳 전부 (`/api/spot-routes`의 outbound, 시각은 없음)
 *
 *    그래서 세 단계로 말한다. 시각을 아는 곳은 시각을, 없다고 확인된 곳은 없다고,
 *    아직 확인하지 못한 곳은 노선만. **추정치를 막차처럼 적지 않는다.**
 */
const props = defineProps<{
  /** 사람이 확인한 7곳만 있다. 나머지는 null이다(`/api/spot-bus`가 404). */
  schedule?: SpotTimetable | null
  /** 관광지 → 시내 노선. 44곳 전부에 있다. 시각은 들어 있지 않다. */
  outbound?: SpotRouteOption[]
}>()

const t = useT()
const d = useDisplay()

/** 가는 편 출발지. 영문이 있으면 영문, 없으면 국문이 그대로 나간다. → ADR-030 */
const departFrom = computed(() =>
  d.pick(props.schedule?.outboundFrom, props.schedule?.outboundFromEn),
)

const departTimes = computed(() => {
  const s = props.schedule
  return s?.departFirst && s?.departLast ? t.value.bus.firstLast(s.departFirst, s.departLast) : null
})

const returnFrom = computed(() => d.pick(props.schedule?.returnFrom, props.schedule?.returnFromEn))

const returnTimes = computed(() => {
  const s = props.schedule
  return s?.returnTimesKnown && s?.returnFirst && s?.returnLast
    ? t.value.bus.firstLast(s.returnFirst, s.returnLast)
    : null
})

/**
 * 돌아오는 편 시각이 **없다고 확인된** 상태.
 *
 * `undefined`(아직 안 본 곳)와 구분한다. 저쪽은 "모른다", 이쪽은 "보았고 없다"이다.
 * 두 문장이 달라야 하는 이유는 여행자가 할 일이 다르기 때문이다 — 후자는 현장에서
 * 기사에게 물으면 되고, 전자는 출발 전에 확인해야 한다.
 */
const returnKnownAbsent = computed(() => props.schedule?.returnTimesKnown === false)

/** 시각을 모를 때 대신 말할 노선 번호. 덜 걷는 순으로 이미 정렬돼 온다. */
const returnRoutes = computed(() =>
  (props.outbound ?? [])
    .slice(0, 5)
    .map((option) => option.routeNum)
    .join(' · '),
)

/** 할 말이 하나도 없으면 블록 자체를 띄우지 않는다. 빈 상자는 정보가 아니다. */
const hasAnything = computed(
  () => Boolean(departTimes.value || returnTimes.value || returnKnownAbsent.value || returnRoutes.value),
)
</script>

<template>
  <section
    v-if="hasAnything"
    class="mt-3 rounded-md border border-hairline px-4 py-3.5 text-sm leading-relaxed"
  >
    <b class="block text-[13px] font-semibold text-muted">{{ t.home.scheduleHead }}</b>

    <!-- 가는 편 막차. 야경 명소인데 막차가 18:45라는 사실이 여기서 갈린다. -->
    <p v-if="departTimes" class="mt-2 flex flex-wrap items-baseline gap-x-2">
      <span class="flex-none text-[13px] text-muted">{{ t.home.departLabel }}</span>
      <span class="font-medium text-ink">
        <template v-if="departFrom">{{ t.bus.departsFrom(departFrom) }} · </template>
        {{ departTimes }}
      </span>
    </p>

    <p class="mt-1.5 flex flex-wrap items-baseline gap-x-2">
      <span class="flex-none text-[13px] text-muted">{{ t.bus.returnTrip }}</span>

      <!-- ① 시각을 안다 — 44곳 중 2곳뿐이다. -->
      <span v-if="returnTimes" class="font-medium text-ink">
        <template v-if="returnFrom">{{ t.bus.departsFrom(returnFrom) }} · </template>
        {{ returnTimes }}
      </span>

      <!--
        ② 보았고 없다. 추측해 채우지 않는다 — 여기서 시각을 지어내면 관광지에
           갇히는 사람이 생긴다. → ADR-016
      -->
      <span v-else-if="returnKnownAbsent" class="text-body">
        {{ t.home.returnUnknownShort }}
      </span>

      <!--
        ③ 시각은 모르지만 나오는 노선은 안다. 번호만 말한다.

        ⚠️ "시각 미확인"을 아랫줄로 내리지 않는다. 44곳 중 37곳이 이 분기라
           **가장 흔한 상태가 가장 자리를 많이 먹고 있었다.** 본문이 "모른다"인 줄에
           한 행을 더 줄 이유가 없다. 꼬리표로 붙이고 가장 약한 톤을 준다. → ADR-051
      -->
      <span v-else-if="returnRoutes" class="text-body">
        {{ returnRoutes }}
        <span class="text-[13px] text-muted-soft"> · {{ t.home.returnTimeUnknown }}</span>
      </span>

      <span v-else class="text-body">{{ t.walk.returnUnknown }}</span>
    </p>
  </section>
</template>
