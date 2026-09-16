<script setup lang="ts">
import type { Spot } from '#shared/types/static-data'
import type { StationPin } from '#shared/types/bus'
import { distanceMeters } from '#shared/constants/location'

/**
 * 목적지 검색 — **검색창 하나가 목적지 칩을 겸한다**
 *
 * 홈은 두 상태를 오간다. 목적지가 없으면 "지금 접근 중인 버스", 있으면 "거기로
 * 가는 버스". 예전에는 검색창과 목적지 칩이 자리를 주고받았는데, 이제 **하나가
 * 두 상태를 다 표현한다.** 비어 있으면 검색창이고, 차 있으면 목적지 표시다.
 *
 * ⚠️ 이 컴포넌트는 **주소를 만들지 않는다.** `?to=`/`?stop=` 계약은 그것을 읽는
 *    `index.vue`가 혼자 갖는다. 여기는 픽셀만, 페이지는 주소만 맡는다.
 *
 * ADR-052가 이 기능을 걷어냈던 이유(엉뚱한 결과)는 `app/utils/search.ts`가
 * 실측으로 해소했다. 여기 남은 함정은 **한글 IME** 하나뿐이고, 아래 두 곳에 있다.
 */
const props = defineProps<{
  /** 홈이 이미 받아 둔 관광지 44곳. */
  spots: Spot[]
  /** 승강장 2,105곳. 이름으로 묶어서 쓴다 — 아래 `stopRows` 참고. */
  stations: StationPin[]
  /** 내 위치. **여기서 밖으로 나가지 않는다.** 거리 계산은 브라우저가 한다. → ADR-024 */
  coords: { lat: number; lng: number } | null
  /** 주소에서 온 목적지 이름. 입력창 값의 정본이다. */
  destinationName: string | null
  /** ✕가 갈 주소. 목적지 해제는 주소를 바꾸는 일이다. → ADR-031 */
  clearTo: string
}>()

const emit = defineEmits<{ select: [{ to: string } | { stop: string }] }>()

const t = useT()
const d = useDisplay()

/** 화면에 뜨는 결과 수. 더 있으면 "그 외 N곳"으로 한 줄만 덧붙인다. */
const LIMIT = 5

const keyword = ref(props.destinationName ?? '')
const open = ref(false)
const activeIndex = ref(0)
/** 한글 조합 중인지. 조합 중에는 입력창 값을 밖에서 건드리지 않는다. */
const composing = ref(false)

/**
 * 주소 → 입력창. **한 방향뿐이다.**
 *
 * `keyword`가 바뀌어도 주소는 안 바뀌므로(선택해야 바뀐다) 되돌아올 길이 없다.
 * 이 비대칭이 무한 루프를 구조적으로 막는다.
 *
 * ⚠️ 조합 중에는 건너뛴다. 조합 중인 입력값을 밖에서 덮어쓰면 커서가 튀고 글자가
 *    되돌아간다 — `v-model`을 걷어내며 고쳤던 그 증상이다. → ADR-053
 */
watch(
  () => props.destinationName,
  (name) => {
    if (composing.value) return
    keyword.value = name ?? ''
    open.value = false
  },
)

const query = computed(() => normalizeQuery(keyword.value))

interface Row {
  key: string
  label: string
  /** 정류장 결과에만 붙는 꼬리표. 관광지는 이 화면의 기본이라 아무것도 안 붙인다. */
  isStop: boolean
  distance: number | null
  payload: { to: string } | { stop: string }
}

function distanceTo(lat: number, lng: number): number | null {
  return props.coords ? distanceMeters(props.coords.lat, props.coords.lng, lat, lng) : null
}

/**
 * 관광지 후보. `cityPrefix`를 켠다 — 상류가 이름 앞에 시군명을 붙여 오는데
 * 사람은 "하회"라고 친다.
 */
const spotRows = computed<Row[]>(() =>
  rankedMatches(props.spots, (spot) => d.name(spot), query.value, true).map((spot) => ({
    key: `spot:${spot.id}`,
    label: d.name(spot),
    isStop: false,
    distance: distanceTo(spot.lat, spot.lng),
    payload: { to: spot.id },
  })),
)

/**
 * 정류장 후보. **이름으로 묶는다** — 승강장 2,105곳이지만 이름은 1,154종이다.
 * 같은 이름의 승강장이 길 양쪽에 서 있는 것을 두 줄로 보여줄 이유가 없고,
 * `?stop=`이 애초에 이름을 받는다.
 *
 * ⚠️ `cityPrefix`를 **켜지 않는다.** 정류장에서 `안동`은 고유명사의 일부다
 *    (`안동병원`·`안동초등학교`). 켜면 `"병원"`이 8곳에서 1곳으로 준다. → ADR-054
 */
const stopRows = computed<Row[]>(() => {
  const byName = new Map<string, StationPin>()
  for (const station of props.stations) {
    const seen = byName.get(station.stationNm)
    if (!seen) {
      byName.set(station.stationNm, station)
      continue
    }
    // 같은 이름이면 가까운 승강장의 거리를 그 줄의 거리로 쓴다.
    const a = distanceTo(station.lat, station.lng)
    const b = distanceTo(seen.lat, seen.lng)
    if (a !== null && b !== null && a < b) byName.set(station.stationNm, station)
  }
  return rankedMatches(
    [...byName.values()],
    (station) => d.stationName(station),
    query.value,
    false,
  ).map((station) => ({
    key: `stop:${station.stationNm}`,
    label: d.stationName(station),
    isStop: true,
    distance: distanceTo(station.lat, station.lng),
    // ⚠️ 주소에는 **국문 원문**을 싣는다. 화면 글자(영문 화면에서는 영문)를 그대로
    //    실으면 `/api/stop-boarding/[name]` 조회가 전부 404다. → ADR-030
    payload: { stop: station.stationNm },
  }))
})

/**
 * 관광지가 한 곳이라도 걸리면 **정류장은 평가조차 하지 않는다.**
 *
 * ADR-052가 지목한 "후보를 섞지 말 것"의 답이다. 관광지 44곳과 정류장 이름
 * 1,154종을 한 목록에 담으면 `"안동"` 한 번에 정류장 48종이 쏟아졌다. 덤으로
 * "관광지 병산서원 + 정류장 병산서원"이 나란히 서는 일도 구조적으로 사라진다 —
 * 합치는 코드가 따로 필요 없다.
 */
const rows = computed<Row[]>(() => {
  if (!query.value) return []
  const spots = spotRows.value
  return spots.length ? spots : stopRows.value
})

/** 가까운 곳이 위로. 거리를 모르면(좌표 거부) 순위 순서 그대로 둔다. */
const sorted = computed(() =>
  [...rows.value].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)),
)

const visible = computed(() => sorted.value.slice(0, LIMIT))
const overflow = computed(() => Math.max(0, sorted.value.length - LIMIT))

/**
 * 결과가 바뀔 때마다 첫 줄로 되돌린다.
 *
 * 강조된 줄이 **항상 화면에 보여야** Enter가 무엇을 고를지 눈으로 확인하고 누른다.
 * 그게 없으면 "맹목적 Enter"가 ADR-052의 엉뚱한 결과를 다시 만든다.
 */
watch(visible, () => {
  activeIndex.value = 0
})

const listVisible = computed(() => open.value && Boolean(query.value))

/**
 * ⚠️ 입력값을 **가공하지 않고 그대로** 담는다. `normalizeQuery`는 파생 computed에서만
 *    쓰고 절대 되쓰지 않는다. `:value`가 DOM 값과 달라지는 순간 Vue가 조합 중인
 *    입력을 덮어써서 커서가 튄다. → ADR-053
 */
function onInput(event: Event) {
  keyword.value = (event.target as HTMLInputElement).value
  open.value = true
}

function choose(row: Row) {
  open.value = false
  emit('select', row.payload)
}

function cancel() {
  open.value = false
  // 고치다 만 글자를 남기지 않는다. 입력창은 "병산", 도착 카드는 "도산서원까지
  // 약 44분"을 동시에 말하는 화면이 되면 안 된다.
  keyword.value = props.destinationName ?? ''
}

function onKeydown(event: KeyboardEvent) {
  /**
   * ⚠️ **이 화면에서 가장 중요한 한 줄이다.**
   *
   * 한글 조합 중의 Enter는 IME가 글자를 확정하는 키이고, ↓는 후보 창의 키다.
   * 가로채면 "하회"를 확정하려는 순간 엉뚱한 곳으로 이동한다. `keyCode === 229`는
   * `isComposing`을 안 주는 옛 브라우저용 보험이다.
   */
  if (event.isComposing || event.keyCode === 229) return

  if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    cancel()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!visible.value.length) return
    event.preventDefault()
    open.value = true
    const step = event.key === 'ArrowDown' ? 1 : -1
    // 순환하지 않는다. 양 끝에서 멈추면 목록의 처음과 끝이 손끝으로 느껴진다.
    activeIndex.value = Math.min(
      visible.value.length - 1,
      Math.max(0, activeIndex.value + step),
    )
    return
  }
  if (event.key === 'Enter') {
    const row = visible.value[activeIndex.value]
    if (!row) return
    event.preventDefault()
    choose(row)
  }
}
</script>

<template>
  <!-- 결과는 **띄워 올린다.** 자리를 밀면 타이핑할 때마다 아래 도착 카드가 위아래로 움직인다. → ADR-050 -->
  <div class="relative mb-3">
    <div
      class="flex h-12 w-full items-center gap-2.5 rounded-full border bg-white pl-4 pr-1.5"
      :class="destinationName ? 'border-primary/40' : 'border-hairline'"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        class="h-[17px] w-[17px] flex-none"
        :class="destinationName ? 'text-primary' : 'text-muted'"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5L21 21" />
      </svg>

      <!--
        ⚠️ `v-model`이 아니다. **일부러** 뺐다. `v-model`은 한글 조합 중의 `input`을
        무시해서 목록이 한 음절씩 뒤처진다. 조합 중간의 낱자는 `normalizeQuery`가
        떼어낸다. `browse.vue`와 같은 처리다. → ADR-053

        ⚠️ `type="search"`도 **일부러** 아니다(`browse.vue`는 그쪽이다). 크롬이
        `search`에 기본 ✕를 그리는데, 그 ✕는 **글자만 지우고 목적지는 안 지운다.**
        실제로 우리 ✕와 나란히 서서 둘 중 무엇이 해제인지 알 수 없었고, 기본 ✕를
        누르면 입력창은 비었는데 아래 "돌아오는 편"은 도산서원을 말하는 화면이 됐다.
        둘러보기는 기본 ✕가 유일한 해제라 문제가 없지만 여기는 다르다.
      -->
      <input
        :value="keyword"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="destination-results"
        :aria-expanded="listVisible"
        :aria-activedescendant="listVisible ? `destination-row-${activeIndex}` : undefined"
        :placeholder="t.home.destinationSearch"
        :aria-label="t.home.destinationSearchLabel"
        class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
        :class="destinationName && !open ? 'font-semibold text-primary' : ''"
        @input="onInput"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @keydown="onKeydown"
        @focus="open = true"
        @blur="cancel()"
      />

      <!--
        해제는 버튼이 아니라 **링크**다. 목적지는 주소에 실려 있으므로 지우는 것도
        주소를 바꾸는 일이고, 그래야 뒤로가기와 새 탭이 동작한다. → ADR-031
      -->
      <NuxtLink
        v-if="destinationName"
        :to="clearTo"
        class="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted"
        :aria-label="t.home.destinationClear"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </NuxtLink>
    </div>

    <!--
      `main.css`: 종이 한 장처럼 얹혀야 하는 것(검색창·시트·지도 위 알약)은 흰색.
      `z-40`은 헤더·탭바(`z-50`) 아래다 — 전역 내비를 덮는 오버레이보다 낫다.
    -->
    <div
      v-if="listVisible"
      id="destination-results"
      role="listbox"
      class="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[min(20rem,45dvh)] overflow-y-auto overscroll-contain rounded-2xl border border-hairline bg-white py-1.5 shadow-float"
    >
      <button
        v-for="(row, index) in visible"
        :id="`destination-row-${index}`"
        :key="row.key"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        class="flex w-full items-baseline gap-2 px-4 py-2.5 text-left text-sm"
        :class="index === activeIndex ? 'bg-surface-soft' : ''"
        @mousedown.prevent
        @click="choose(row)"
      >
        <b class="min-w-0 flex-1 truncate font-medium text-ink">{{ row.label }}</b>
        <span v-if="row.isStop" class="flex-none text-[12px] text-muted-soft">
          {{ t.home.destinationSearchStops }}
        </span>
        <!-- 거리를 적는 이유: "14.6km"를 보면 걸어갈 생각을 접는다. → ADR-050 -->
        <span v-if="row.distance !== null" class="flex-none text-[13px] tabular-nums text-muted">
          {{ formatDistance(row.distance, d.locale.value) }}
        </span>
      </button>

      <p v-if="overflow" class="px-4 py-2 text-[13px] text-muted-soft">
        {{ t.home.destinationSearchMore(overflow) }}
      </p>

      <p v-if="!visible.length" class="px-4 py-2.5 text-sm text-muted">
        {{ t.home.destinationSearchEmpty(query) }}
      </p>
    </div>
  </div>
</template>
