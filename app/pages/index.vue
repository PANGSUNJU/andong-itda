<script setup lang="ts">
import type { ArrivalWithSpots, NearbyStation, StationPin } from '#shared/types/bus'
import type { Spot } from '#shared/types/tour'
import { busMinutes, nearest } from '#shared/constants/location'

/**
 * 지금 여기 — 홈
 *
 * 정보 순서가 곧 이 서비스의 주장이다. → ADR-012
 *   1. 가까운 정류장의 다음 버스 (몇 분 후)
 *   2. 그 시간 안에 걸어서 갈 수 있는 곳
 *   3. 안동에서 많이 찾는 곳
 *
 * 첫 렌더는 항상 안동역 기준이다. 서버에는 위치가 없다.
 * 브라우저에서 좌표가 잡히면 세 목록이 함께 갱신된다.
 */
const t = useT()
const d = useDisplay()
const localePath = useLocalePath()

usePageTitle(() => t.value.home.title)

const { location, locating, locate } = useLocation()

/** 위치 상태는 키만 들고 있다. 문구는 지금 언어로 여기서 만든다. → `useLocation` */
const placeLabel = computed(() => t.value.location[location.value.label])
const locationReason = computed(() =>
  location.value.reason ? t.value.location[location.value.reason] : null,
)

const coords = computed(() => ({ lat: location.value.lat, lng: location.value.lng }))

/**
 * 목록을 통째로 받고 거리 계산은 브라우저에서 한다.
 * 좌표를 서버로 보내지 않기 위해서다. → ADR-024
 *
 * 정류장 2107건 153KB(gzip 31KB), 관광지 64건. 둘 다 라우트에서 1일 캐시된다.
 * SSR에서는 안동역 폴백 기준으로 계산되고, 브라우저에서 좌표가 잡히면
 * 같은 computed가 다시 돈다. 그때 네트워크 요청은 더 나가지 않는다.
 */
const { data: allStations } = await useFetch<StationPin[]>('/api/bus/stations', {
  default: () => [],
})
const { data: spots } = await useFetch<Spot[]>('/api/spots', { default: () => [] })

/**
 * 도착정보가 오지 않는 승강장은 뒤로 보낸다
 *
 * 안동터미널처럼 노선의 기점·종점으로만 쓰이는 승강장에는 "접근 중인 차량"이
 * 성립하지 않아 도착정보가 항상 빈 배열이다(→ ADR-015). 그런 칩이 맨 앞에 오면
 * 첫 화면이 "버스가 없어요"로 열린다. 지우지는 않는다 — 실재하는 승강장이고,
 * 거기 서 있는 사람에게는 "여기는 안 뜬다"는 사실 자체가 답이다.
 */
const stations = computed<NearbyStation[]>(() => {
  const near = nearest(allStations.value, coords.value, { limit: 5 })
  return [...near.filter((s) => !s.terminusOnly), ...near.filter((s) => s.terminusOnly)]
})

/**
 * 같은 이름의 정류장이 방향별로 여러 개 있다.
 * 실측: "안동역(안동터미널)"이 stationId 354000416 / 354000459 / 354000536으로 셋이다.
 * 가장 가까운 승강장이 내가 갈 방향이라는 보장이 없으므로 전환할 수 있어야 한다.
 */
const selectedId = ref<number | null>(null)
const activeStation = computed(
  () => stations.value.find((s) => s.stationId === selectedId.value) ?? stations.value[0],
)

/**
 * 승강장을 가르는 한 줄 — 이름이 같은 셋을 여기서 구분한다
 *
 * 카카오·네이버가 "노하동입구 방면"으로 가르는 그 정보다.
 * 같은 이름 셋을 그냥 늘어놓으면 여행자는 어느 것도 고를 수 없다.
 */
function stationTag(station: NearbyStation): string {
  if (station.terminusOnly) return t.value.home.terminusTag
  // 방면은 다음 정류장의 국문 이름이다. 그 이름에 영문 상대가 없다. → ADR-030
  return station.direction ? t.value.home.directionTag(station.direction) : ''
}

/** 30m 안쪽이면 "바로 앞"으로 끝낸다. "바로 앞 · 걸어서 약 1분"은 같은 말을 두 번 한다. */
const stationSubtitle = computed(() => {
  const station = activeStation.value
  if (!station) return undefined

  const near =
    station.distance < 30
      ? t.value.home.rightHere
      : t.value.home.walkFromHere(
          formatDistance(station.distance, d.locale.value),
          station.walkMinutes,
        )

  const tag = stationTag(station)
  return tag ? `${tag} · ${near}` : near
})

const {
  data: arrivals,
  pending: arrivalsPending,
  error: arrivalsError,
  refresh: refreshArrivals,
} = await useFetch<ArrivalWithSpots[]>('/api/bus/arrivals', {
  query: computed(() => ({ stationId: activeStation.value?.stationId })),
  default: () => [],
})

/**
 * 도착 정보를 마지막으로 받은 시각
 *
 * SSR에서는 만들지 않는다. 서버 시각으로 "방금"을 찍으면 하이드레이션이 어긋난다.
 * 정류장을 바꿔도 다시 받으므로 `arrivals`를 지켜본다.
 */
const updatedAt = ref<number | null>(null)
onMounted(() => (updatedAt.value = Date.now()))
watch(arrivals, () => (updatedAt.value = Date.now()))

async function refreshNow() {
  await refreshArrivals()
  updatedAt.value = Date.now()
}

/** 여기서 끊지 않고 카카오맵까지 잇는다. 승강장이 셋이라 좌표로 넘겨야 정확하다. */
const stationDirectionsUrl = computed(() =>
  activeStation.value
    ? kakaoDirectionsUrl(
        activeStation.value.stationNm,
        activeStation.value.lat,
        activeStation.value.lng,
      )
    : undefined,
)

/**
 * 반경을 넓게 잡아 한 번만 고르고 화면에서 나눈다.
 * 안동역 반경 2km 안에는 관광지가 2곳뿐이라, 도보권만 보여주면 띠가 비어 버린다.
 */
const nearbySpots = computed(() =>
  nearest(spots.value, coords.value, { radius: 30_000, limit: 12 }),
)

const WALKABLE_M = 2000
const walkable = computed(() => nearbySpots.value.filter((s) => s.distance <= WALKABLE_M))
const rideable = computed(() =>
  nearbySpots.value.filter((s) => s.distance > WALKABLE_M).slice(0, 6),
)

/**
 * 지도의 두 모드 — 걸어서 / 버스로
 *
 * 한 지도에 둘을 겹치지 않는다. 도보권은 반경 2km이고 버스로 갈 곳은 30km까지
 * 흩어져 있어서, 다 담으려면 지도가 안동시 전체로 물러난다. 그러면 이 지도의 본래
 * 일 — "83m 떨어진 저 승강장이 길 건너인가"를 눈으로 가르는 것 — 이 먼저 죽는다.
 * 대신 무엇을 보고 있는지 캡션 옆에서 바꾼다.
 *
 * 두 모드 모두 반경 원과 "나"는 남는다. 버스 모드에서 원은 작게 찍히는데,
 * 그 작음 자체가 "걸어서는 여기까지"라는 뜻이라 지우지 않는다.
 */
const mapMode = ref<'walk' | 'ride'>('walk')

/**
 * 걸어서 — 걸어갈 곳과 서야 할 승강장을 함께 찍는다
 *
 * 승강장을 빼놓으면 이름이 같은 셋을 글자로만 갈라야 한다. "83m 떨어진 다른 승강장"이
 * 길 건너인지 같은 쪽인지는 점 세 개를 보면 한 번에 끝난다.
 */
const walkMarkers = computed(() => [
  // 지도 위 이름은 국문 그대로다. 배경 지도(카카오맵)가 국문이라 여기만 영문을
  // 인쇄하면 지도에 적힌 지명과 어긋나 오히려 못 찾는다. → MapCard
  ...walkable.value.map((spot) => ({ lat: spot.lat, lng: spot.lng, name: spot.name })),
  ...stations.value.map((station) => ({
    lat: station.lat,
    lng: station.lng,
    name: station.stationNm,
    // 상시 이름표(고른 승강장)와 눌렀을 때 뜨는 문구가 이걸 함께 쓴다.
    // 이름은 셋이 같으므로 방면이 있어야 어느 승강장인지 갈린다.
    note: stationTag(station),
    kind: 'stop' as const,
    active: station.stationId === activeStation.value?.stationId,
  })),
])

/**
 * 버스로 — 아래 목록과 **같은 여섯 곳**이다
 *
 * 지도와 목록이 다른 말을 하면 둘 다 못 믿는다. `rideable`을 그대로 쓴다.
 *
 * 이름표는 인쇄하지 않는다(`print-names`). 여섯 곳이 시내 쪽으로 뭉쳐서 인쇄하면
 * 이름이 서로를 덮는다. 대신 누르면 "송강미술관 · 버스로 약 15분"이 뜬다 — `note`가
 * 그 문구를 만든다. 정류장은 아예 찍지 않는다. 이 축척에서 다섯 점은 한 덩어리다.
 */
const rideMarkers = computed(() =>
  rideable.value.map((spot) => ({
    lat: spot.lat,
    lng: spot.lng,
    name: spot.name,
    note: t.value.card.busRideMinutes(busMinutes(spot.distance)),
  })),
)

const mapMarkers = computed(() => (mapMode.value === 'ride' ? rideMarkers.value : walkMarkers.value))

const mapCaption = computed(() =>
  mapMode.value === 'ride'
    ? t.value.home.mapCaptionRide(placeLabel.value, rideable.value.length)
    : t.value.home.mapCaption(placeLabel.value, stations.value.length, walkable.value.length),
)

/** 인기 목록은 상류가 준 순위순 그대로다. nearest()는 사본을 정렬하므로 이 순서를 건드리지 않는다. */
const top = computed(() => spots.value.slice(0, 5))

/**
 * 도착 정보는 30초마다 다시 부른다. 이 화면에서 유일하게 초 단위로 늙는 값이다.
 * 탭이 백그라운드일 때까지 부를 이유는 없다.
 */
onMounted(() => {
  locate()

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshNow()
  }, 30_000)

  onUnmounted(() => clearInterval(timer))
})
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0">
        <div class="py-6 pb-4">
          <h1 class="font-serif text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            {{ t.home.heading(placeLabel) }}
          </h1>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            {{ t.home.sub }}
          </p>
          <!--
            위치를 못 잡았을 때 이유만 적어 두면 막다른 길이다. 권한을 나중에 허용해도
            새로고침 말고는 되돌릴 방법이 없었다. 다시 시도를 같은 자리에 둔다.
          -->
          <p v-if="locationReason || locating" class="mt-2 text-[13px] text-muted-soft">
            <template v-if="locating">{{ t.home.locating }}</template>
            <template v-else>
              {{ locationReason }}
              <button
                type="button"
                class="ml-1 font-medium text-muted underline"
                @click="locate()"
              >
                {{ t.home.relocate }}
              </button>
            </template>
          </p>
        </div>

        <div
          v-if="arrivalsError"
          class="rounded-md border border-hairline bg-surface-soft p-6 text-sm leading-relaxed"
        >
          <b class="font-semibold">{{ t.home.busErrorTitle }}</b><br />
          <span class="text-muted">{{ t.home.busErrorBody }}</span>
          <button
            class="mt-3 rounded-sm border border-ink px-4 py-2 text-sm font-medium"
            @click="refreshArrivals()"
          >
            {{ t.common.retry }}
          </button>
        </div>

        <BusPanel
          v-else-if="activeStation"
          :station-nm="activeStation.stationNm"
          :station-nm-en="activeStation.nameEn"
          :subtitle="stationSubtitle"
          :arrivals="arrivals"
          :pending="arrivalsPending"
          :terminus-only="activeStation.terminusOnly"
          :updated-at="updatedAt"
          :directions-url="stationDirectionsUrl"
          @refresh="refreshNow()"
        />

        <!--
          정류장 전환. 방향이 다른 승강장을 고르는 유일한 수단이다.

          줄바꿈이 아니라 가로 스크롤이다. 최대 5개인데 이름이 길어
          ("안동역(안동터미널) 120m") 폰에서 접히면 세 줄까지 늘어나고,
          그만큼 본체인 도착 카드가 화면 밖으로 밀린다. 세로는 아껴야 하는
          자원이고 가로는 남는다. 넓은 화면에서는 대개 다 들어가 스크롤이 안 생긴다.
        -->
        <div v-if="stations.length > 1" class="mt-3 flex gap-2 overflow-x-auto">
          <button
            v-for="station in stations"
            :key="station.stationId"
            class="flex-none rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors"
            :class="[
              station.stationId === activeStation?.stationId
                ? 'border-ink bg-ink text-white'
                : 'border-hairline text-body hover:bg-surface-soft',
              // 도착이 안 뜨는 승강장은 뒤로 밀어 놨다. 눌러볼 수는 있게 두되 앞선 것과 무게를 다르게 준다.
              station.terminusOnly && station.stationId !== activeStation?.stationId
                ? 'opacity-60'
                : '',
            ]"
            @click="selectedId = station.stationId"
          >
            <span class="block whitespace-nowrap">{{ d.stationName(station) }}</span>
            <!--
              방면이 이름을 가른다. 같은 이름 셋을 구분하는 유일한 정보이므로
              칩이 두 줄이 되는 것을 감수한다.
            -->
            <span class="mt-0.5 block whitespace-nowrap text-xs font-normal opacity-70">
              {{
                [stationTag(station), formatDistance(station.distance, d.locale.value)]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </span>
          </button>
        </div>

        <!--
          지도는 정류장 칩 바로 아래다. 고르는 것(칩)과 보는 것(점)이 붙어 있어야
          "83m 떨어진 다른 승강장"이 길 건너인지 같은 쪽인지가 한눈에 온다.

          도보권 관광지 섹션 안에 두었더니 그 목록이 비는 위치에서는 지도까지 통째로
          사라졌다. 정류장은 어디서든 있어야 하므로 밖으로 꺼냈다.

          반경 원은 "버스로"에서만 그린다. 걸어서 모드는 동네 크기로 확대되는데,
          그 축척에서 반경 2km 원은 화면보다 커서 호가 안 보이고 분홍색만 깔린다.
          "걸어갈 수 있는 범위"라는 뜻은 걸어서 모드에서는 캡션이 대신 말한다.
        -->
        <MapCard
          class="mt-4"
          height="220px"
          :center="coords"
          mark-center
          :radius-m="mapMode === 'ride' ? WALKABLE_M : undefined"
          :markers="mapMarkers"
          :caption="mapCaption"
          :print-names="mapMode === 'walk'"
        >
          <!--
            버스로 갈 곳이 없으면 전환할 것도 없다. 안동 밖에서 접속하면 폴백이
            안동역이라 늘 채워지지만, 반경 30km 안이 비는 경우까지 버튼을 남겨 두면
            눌러도 아무 일도 일어나지 않는 버튼이 된다.
          -->
          <template v-if="rideable.length" #action>
            <div class="flex flex-none gap-1 rounded-full bg-surface-soft p-0.5">
              <button
                v-for="mode in (['walk', 'ride'] as const)"
                :key="mode"
                type="button"
                class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                :class="
                  mapMode === mode ? 'bg-ink text-white' : 'text-muted hover:text-body'
                "
                @click="mapMode = mode"
              >
                {{ mode === 'walk' ? t.home.mapTabWalk : t.home.mapTabRide }}
              </button>
            </div>
          </template>
        </MapCard>

        <section v-if="walkable.length" class="mt-8">
          <div class="mb-4">
            <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
              {{ t.home.walkableHeadLead
              }}<em class="not-italic text-primary">{{ t.home.walkableHeadEmphasis }}</em>
            </h2>
            <p class="mt-1 text-sm text-muted">{{ t.home.walkableSub }}</p>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3">
            <SpotCard v-for="spot in walkable" :key="spot.id" :spot="spot" />
          </div>
        </section>

        <section v-if="rideable.length" class="mt-8 pb-12">
          <div class="mb-4">
            <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
              {{ t.home.rideableHead }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ t.home.rideableSub }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3">
            <SpotCard v-for="spot in rideable" :key="spot.id" :spot="spot" />
          </div>
        </section>
      </div>

      <aside
        class="mt-8 min-w-0 pb-12 desktop:mt-0 desktop:sticky desktop:top-[96px]"
      >
        <div class="mb-4">
          <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
            {{ t.home.popularHead }}
          </h2>
          <p class="mt-1 text-sm text-muted">{{ t.home.popularSub }}</p>
        </div>

        <div class="flex flex-col">
          <NuxtLink
            v-for="spot in top"
            :key="spot.id"
            :to="localePath(`/spots/${spot.id}`)"
            class="flex w-full items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0"
          >
            <span class="w-[22px] flex-none text-center text-base font-semibold text-muted-soft">
              {{ spot.rank }}
            </span>
            <span class="block h-14 w-14 flex-none overflow-hidden rounded-sm">
              <SpotPhoto :src="spot.imageUrl" :alt="d.name(spot)" />
            </span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-base font-medium leading-tight">{{ d.name(spot) }}</b>
              <span class="mt-0.5 block truncate text-sm text-muted">
                {{ d.category(spot.category) }}
              </span>
            </span>
          </NuxtLink>
        </div>

        <NuxtLink
          :to="localePath('/browse')"
          class="mt-4 inline-block text-base font-medium underline"
        >
          {{ t.home.seeAll }}
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
