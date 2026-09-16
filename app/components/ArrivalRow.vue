<script setup lang="ts">
/**
 * 도착 한 줄 — 노선번호 / 방향 / 도착까지
 *
 * BusArrival 전체가 아니라 화면이 쓰는 네 필드만 받는다.
 * /api/spot-bus는 애초에 이 네 개만 내려주므로 두 화면이 같은 컴포넌트를 쓴다.
 */
const props = defineProps<{
  routeNum: string
  via: string
  /** via의 종점이 비어 올 때 방면을 여기서 건진다. → `formatDirection` */
  routeNm?: string
  predictTm: number | null
  remainStation: number | null
  /**
   * 이 버스가 닿는 관광지. 홈에서만 온다.
   * 관광지 상세는 이미 목적지를 알고 들어온 화면이라 다시 말할 이유가 없다.
   * → ADR-025
   */
  spots?: import('#shared/types/bus').ArrivalSpot[]
  /**
   * 목적지를 정했고 이 차가 그리로 간다면 붙는 표. 홈에서만 온다.
   *
   * 목적지행이 아닌 줄을 지우지 않고 이 표만 붙이는 것이 요점이다. 배차가 하루
   * 3~13회인 노선에서 거르면 화면이 자주 빈다. → `boardingDirection.ts`
   */
  destinationBound?: string
}>()

const t = useT()
const locale = useLocale()

/**
 * 이 줄의 제목. **목적지 > 관광지 > 방면** 순이고, 다 없으면 빈 문자열이다.
 * 빈 문자열이면 줄을 그리지 않는다 — 방면을 모를 때 화살표 조각만 남던 자리다.
 *
 * ⚠️ 목적지행 표를 제목 **아래 배지로** 붙였더니 그 줄만 2행 → 3행이 됐다(최대 +66px).
 *    표가 말하려던 것("이 줄이 목적지행")은 제목 자리에서 더 잘 말해진다 — 어차피
 *    이 줄의 본문이 방면이고, 목적지행이면 그 방면의 이름이 곧 목적지다.
 *    색(primary)·굵기(semibold)·문구(목적지 이름) 셋이 한꺼번에 그 사실을 말하고,
 *    바로 위 목적지 칩과 글자가 같아 대조가 즉시 된다. → ADR-051
 *
 * ⚠️ 관광지 이름은 두 언어에서 같다. 이 이름은 버스 API의 노선 문자열에서 온
 *    국문 지명이라 영문을 붙일 상대가 없다. `spots[]`는 정류장 순번으로 판정한
 *    결과이고(ADR-025) 상류가 그 목록에 영문을 주지 않는다.
 */
const headline = computed(
  () =>
    props.destinationBound ||
    (props.spots?.length
      ? props.spots.map((spot) => spot.name).join(' · ')
      : formatDirection(props.via, props.routeNm, locale.value)),
)
</script>

<template>
  <div class="flex w-full items-center gap-3 border-t border-hairline-soft py-3 text-left">
    <span
      class="min-w-[60px] flex-none rounded-sm bg-surface-strong px-2.5 py-1.5 text-center text-sm font-semibold"
    >
      {{ routeNum }}
    </span>

    <span class="min-w-0 flex-1">
      <!--
        관광지를 앞세우고 방향은 폴백으로 쓴다.
        둘을 나란히 두면 같은 이름이 두 줄 반복된다. 매핑된 관광지가 대부분
        노선의 종점이라 formatDirection(via)이 만드는 "○○ 방면"과 겹치기
        때문이다(2026-08-10 실측: 병산·봉정·도산 전부 종점). → ADR-025
      -->
      <!--
        목적지행이면 색과 굵기로만 구분한다. 배지를 따로 붙이지 않는 이유는
        위 `headline` 주석에 있다 — 줄이 3행이 되기 때문이다.
      -->
      <b
        v-if="headline"
        class="block truncate text-base leading-tight"
        :class="destinationBound ? 'font-semibold text-primary' : 'font-medium'"
      >
        {{ headline }}
      </b>

      <span v-if="remainStation !== null" class="block text-[13px] leading-tight text-muted">
        {{ t.common.stopsAway(remainStation) }}
      </span>
    </span>

    <span class="flex-none text-right">
      <b class="block text-base font-semibold leading-tight">
        {{ predictTm !== null ? `${predictTm}${t.common.minuteUnit}` : '—' }}
      </b>
      <span class="mt-0.5 block text-[13px] text-muted">
        {{ predictTm !== null ? t.bus.after : t.bus.locating }}
      </span>
    </span>
  </div>
</template>
