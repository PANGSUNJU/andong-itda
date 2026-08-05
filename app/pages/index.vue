<script setup lang="ts">
import type { BusArrival, NearbyStation } from '#shared/types/bus'
import type { Spot } from '#shared/types/tour'

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
useHead({ title: '지금 여기 · 안동잇다' })

const { location, locate } = useLocation()

const coords = computed(() => ({ lat: location.value.lat, lng: location.value.lng }))

const { data: stations } = await useFetch<NearbyStation[]>('/api/bus/nearby-stations', {
  query: computed(() => ({ ...coords.value, limit: 5 })),
  default: () => [],
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

/** 30m 안쪽이면 "바로 앞"으로 끝낸다. "바로 앞 · 걸어서 약 1분"은 같은 말을 두 번 한다. */
const stationSubtitle = computed(() => {
  const station = activeStation.value
  if (!station) return undefined
  if (station.distance < 30) return '바로 앞이에요'
  return `${formatDistance(station.distance)} · 걸어서 약 ${station.walkMinutes}분`
})

const {
  data: arrivals,
  pending: arrivalsPending,
  error: arrivalsError,
  refresh: refreshArrivals,
} = await useFetch<BusArrival[]>('/api/bus/arrivals', {
  query: computed(() => ({ stationId: activeStation.value?.stationId })),
  default: () => [],
})

/**
 * 반경을 넓게 잡아 한 번만 부르고 화면에서 나눈다.
 * 안동역 반경 2km 안에는 관광지가 2곳뿐이라, 도보권만 보여주면 띠가 비어 버린다.
 */
const { data: nearbySpots } = await useFetch<Spot[]>('/api/spots/nearby', {
  query: computed(() => ({ ...coords.value, radius: 30_000, limit: 12 })),
  default: () => [],
})

const WALKABLE_M = 2000
const walkable = computed(() => nearbySpots.value.filter((s) => (s.distance ?? 0) <= WALKABLE_M))
const rideable = computed(() =>
  nearbySpots.value.filter((s) => (s.distance ?? 0) > WALKABLE_M).slice(0, 6),
)

const { data: popular } = await useFetch<Spot[]>('/api/spots', { default: () => [] })
const top = computed(() => popular.value.slice(0, 5))

/**
 * 도착 정보는 30초마다 다시 부른다. 이 화면에서 유일하게 초 단위로 늙는 값이다.
 * 탭이 백그라운드일 때까지 부를 이유는 없다.
 */
onMounted(() => {
  locate()

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshArrivals()
  }, 30_000)

  onUnmounted(() => clearInterval(timer))
})
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0">
        <div class="py-6 pb-4">
          <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            지금 {{ location.label }} 부근이에요
          </h1>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            가까운 정류장의 버스와, 기다리는 동안 다녀올 만한 곳이에요
          </p>
          <p v-if="location.reason" class="mt-2 text-[13px] text-muted-soft">
            {{ location.reason }}
          </p>
        </div>

        <div
          v-if="arrivalsError"
          class="rounded-md border border-hairline bg-surface-soft p-6 text-sm leading-relaxed"
        >
          <b class="font-semibold">버스 정보를 가져오지 못했어요.</b><br />
          <span class="text-muted">안동시 버스정보 시스템이 응답하지 않고 있어요.</span>
          <button
            class="mt-3 rounded-sm border border-ink px-4 py-2 text-sm font-medium"
            @click="refreshArrivals()"
          >
            다시 시도
          </button>
        </div>

        <BusPanel
          v-else-if="activeStation"
          :station-nm="activeStation.stationNm"
          :subtitle="stationSubtitle"
          :arrivals="arrivals"
          :pending="arrivalsPending"
        />

        <!-- 정류장 전환. 방향이 다른 승강장을 고르는 유일한 수단이다. -->
        <div v-if="stations.length > 1" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="station in stations"
            :key="station.stationId"
            class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            :class="
              station.stationId === activeStation?.stationId
                ? 'border-ink bg-ink text-white'
                : 'border-hairline text-body hover:bg-surface-soft'
            "
            @click="selectedId = station.stationId"
          >
            {{ station.stationNm }}
            <span class="ml-1 text-xs opacity-70">{{ formatDistance(station.distance) }}</span>
          </button>
        </div>

        <section v-if="walkable.length" class="mt-8">
          <div class="mb-4">
            <h2 class="text-[22px] font-medium leading-tight tracking-[-0.44px]">
              걸어서 <em class="not-italic text-primary">갈 수 있는 곳</em>
            </h2>
            <p class="mt-1 text-sm text-muted">버스를 기다리는 동안 다녀올 수 있어요</p>
          </div>

          <!--
            반경 원의 중심은 사용자 위치다. 목록의 "걸어서 갈 수 있는 곳"과 같은
            기준(WALKABLE_M)을 넘겨 지도와 카드가 같은 말을 하게 한다.
          -->
          <MapCard
            class="mb-4"
            height="200px"
            :center="coords"
            :radius-m="WALKABLE_M"
            :markers="walkable.map((spot) => ({ lat: spot.lat, lng: spot.lng, name: spot.name }))"
            :caption="`${location.label} 반경 2km · 관광지 ${walkable.length}곳`"
          />

          <div class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3">
            <SpotCard v-for="spot in walkable" :key="spot.id" :spot="spot" />
          </div>
        </section>

        <section v-if="rideable.length" class="mt-8 pb-12">
          <div class="mb-4">
            <h2 class="text-[22px] font-medium leading-tight tracking-[-0.44px]">
              버스로 갈 수 있는 가까운 곳
            </h2>
            <p class="mt-1 text-sm text-muted">
              걸어가기엔 멀어요. 돌아오는 편까지 함께 확인하세요
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
          <h2 class="text-[22px] font-medium leading-tight tracking-[-0.44px]">
            안동에서 많이 찾는 곳
          </h2>
          <p class="mt-1 text-sm text-muted">한국관광공사 방문 데이터 기준</p>
        </div>

        <div class="flex flex-col">
          <NuxtLink
            v-for="spot in top"
            :key="spot.id"
            :to="`/spots/${spot.id}`"
            class="flex w-full items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0"
          >
            <span class="w-[22px] flex-none text-center text-base font-semibold text-muted-soft">
              {{ spot.rank }}
            </span>
            <span class="block h-14 w-14 flex-none overflow-hidden rounded-sm">
              <SpotPhoto :src="spot.imageUrl" :alt="spot.name" />
            </span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-base font-medium leading-tight">{{ spot.name }}</b>
              <span class="mt-0.5 block truncate text-sm text-muted">{{ spot.category }}</span>
            </span>
          </NuxtLink>
        </div>

        <NuxtLink to="/browse" class="mt-4 inline-block text-base font-medium underline">
          전체 보기
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
