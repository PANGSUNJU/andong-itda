<script setup lang="ts">
import type { Spot } from '#shared/types/tour'
import type { SpotBusInfo } from '#shared/types/static-data'
import { nearest } from '#shared/constants/location'

/**
 * 관광지 상세 — 관광 정보와 버스 안내를 한 화면에 둔다
 *
 * 기존 안동 서비스들은 교통(안동버스정보)과 관광(안동관광)이 분리되어 있어
 * 여행자가 앱을 오가야 했다. 이 화면이 제안서에서 밝힌 차별성의 실체다. → ADR-012
 *
 * 상세 전용 엔드포인트는 아직 없다. 목록(/api/spots)에서 찾는다.
 * 목록은 1일 캐시되고 64건뿐이라 추가 왕복 비용이 사실상 없다.
 */
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: spots } = await useFetch<Spot[]>('/api/spots', { default: () => [] })

const spot = computed(() => spots.value.find((candidate) => candidate.id === id.value))

if (!spot.value) {
  throw createError({ statusCode: 404, statusMessage: '찾을 수 없는 관광지예요', fatal: true })
}

useHead({ title: `${spot.value.name} · 안동잇다` })

/**
 * 버스 정보는 이름으로 조회한다. 정류장 매핑이 있는 7곳만 200을 준다.
 * 나머지는 404이고, 그건 오류가 아니라 "아직 확인하지 못한 관광지"라는 뜻이다.
 * error를 그대로 두고 화면에서 구분해 안내한다. → ADR-016
 */
const {
  data: bus,
  error: busError,
  pending: busRequestPending,
  refresh: refreshBus,
} = await useFetch<SpotBusInfo>(() => `/api/spot-bus/${encodeURIComponent(spot.value!.name)}`)

/**
 * 이 화면에는 홈 같은 30초 타이머가 없다. 열어 둔 채로 두면 도착 정보가 그대로 늙으므로
 * 갱신 시각을 적고 새로고침을 붙인다.
 * SSR에서는 시각을 만들지 않는다 — 서버 시각으로 "방금"을 찍으면 하이드레이션이 어긋난다.
 */
const updatedAt = ref<number | null>(null)
onMounted(() => (updatedAt.value = Date.now()))

async function refreshNow() {
  await refreshBus()
  updatedAt.value = Date.now()
}

/** 상류가 아직 확인하지 못한 관광지인지, 정말 없는 이름인지 */
const busPending = computed(() => (busError.value?.data as { data?: { pending?: boolean } })?.data?.pending ?? false)

/**
 * 근처에 함께 볼 곳 — 이미 받아 둔 목록에서 고른다.
 *
 * 관광지 좌표는 공개 정보라 서버로 보내도 무방하지만, 계산 경로를 하나로 둔다.
 * 좌표를 받는 라우트가 남아 있으면 언젠가 사용자 좌표가 그 길로 간다. → ADR-024
 *
 * 자기 자신을 먼저 뺀다. 나중에 빼면 4곳을 고른 뒤 3곳만 남는다.
 */
const around = computed(() =>
  nearest(
    spots.value.filter((candidate) => candidate.id !== id.value),
    spot.value!,
    { radius: 5000, limit: 4 },
  ),
)

/**
 * 지도에는 이 관광지와 함께 볼 곳들을 같이 찍는다.
 * 한 점만 찍으면 "주변"이라는 캡션이 거짓말이 된다.
 */
const mapMarkers = computed(() =>
  [spot.value!, ...around.value].map((place) => ({
    lat: place.lat,
    lng: place.lng,
    name: place.name,
  })),
)
</script>

<template>
  <div v-if="spot" class="mx-auto max-w-[1080px] px-6">
    <div class="py-6 pb-4">
      <NuxtLink to="/browse" class="text-sm text-muted underline">← 둘러보기</NuxtLink>
      <h1 class="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        {{ spot.name }}
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        <template v-if="spot.rank">{{ spot.rank }}번째로 많이 찾는 곳 · </template>
        {{ spot.category }}
        <template v-if="spot.address"> · {{ spot.address }}</template>
      </p>
    </div>

    <div class="aspect-[4/3] overflow-hidden rounded-md tablet:aspect-[16/7]">
      <SpotPhoto :src="spot.imageUrl" :alt="spot.name" />
    </div>

    <div class="mt-8 desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0 pb-12">
        <section v-if="spot.description" class="pb-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">이런 곳이에요</h2>
          <p class="text-base leading-relaxed text-body">{{ spot.description }}</p>
        </section>

        <section class="border-t border-hairline py-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">가는 방법</h2>

          <template v-if="bus">
            <p class="text-base leading-relaxed text-body">
              <b class="font-semibold">{{ bus.inbound?.stationNm ?? '정류장 미확인' }}</b>에서
              내려요.
              <template v-if="bus.schedule.departFirst">
                {{ bus.schedule.outboundFrom ?? '시내' }}에서 첫차
                {{ bus.schedule.departFirst }}, 막차 {{ bus.schedule.departLast }}예요.
              </template>
            </p>
            <p v-if="!bus.schedule.returnTimesKnown" class="mt-3 text-base leading-relaxed text-body">
              돌아오는 편 시각은 공식 시간표에 없어요.
              <b class="font-semibold">도착하면 먼저 귀로 버스를 확인하세요.</b>
            </p>
          </template>

          <p v-else class="text-base leading-relaxed text-body">
            <template v-if="busPending">
              이 관광지의 정류장은 아직 확인하지 못했어요. 임의로 채우지 않고 비워 둡니다.
            </template>
            <template v-else>
              버스 정보가 등록되지 않은 곳이에요. 현재는 인기 관광지 7곳만 안내하고 있어요.
            </template>
          </p>

          <!--
            버스 정보가 있든 없든 붙인다. 정류장을 아직 확인하지 못한 관광지일수록
            "그럼 어떻게 가나"가 남는데, 그 답을 이 화면에서 끊지 않는다.
          -->
          <a
            :href="kakaoDirectionsUrl(spot.name, spot.lat, spot.lng)"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-flex items-center gap-1.5 rounded-full border border-ink px-4 py-2.5 text-sm font-medium"
          >
            카카오맵으로 길찾기
          </a>
        </section>

        <section v-if="around.length" class="border-t border-hairline py-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
            근처에 함께 볼 곳
          </h2>
          <div class="flex flex-col">
            <NuxtLink
              v-for="candidate in around"
              :key="candidate.id"
              :to="`/spots/${candidate.id}`"
              class="flex w-full items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0"
            >
              <span class="block h-14 w-14 flex-none overflow-hidden rounded-sm">
                <SpotPhoto :src="candidate.imageUrl" :alt="candidate.name" />
              </span>
              <span class="min-w-0 flex-1">
                <b class="block truncate text-base font-medium leading-tight">
                  {{ candidate.name }}
                </b>
                <span class="mt-0.5 block truncate text-sm text-muted">
                  {{ formatDistance(candidate.distance ?? 0) }} · 걸어서 약
                  {{ candidate.walkMinutes }}분
                </span>
              </span>
            </NuxtLink>
          </div>
        </section>
      </div>

      <aside class="min-w-0 pb-12 desktop:sticky desktop:top-[96px]">
        <SpotBusPanel
          v-if="bus"
          :info="bus"
          :updated-at="updatedAt"
          :pending="busRequestPending"
          @refresh="refreshNow()"
        />

        <div v-else class="rounded-md border border-hairline bg-surface-soft p-6">
          <p class="text-base font-medium">버스 안내 준비 중</p>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            <template v-if="busPending">
              정류장을 확인하는 중이에요. 확인되지 않은 정류장을 추측해서 넣지 않아요.
            </template>
            <template v-else> 지금은 인기 관광지 7곳의 버스 정보를 안내하고 있어요. </template>
          </p>
        </div>

        <MapCard
          class="mt-4"
          height="240px"
          :center="{ lat: spot.lat, lng: spot.lng }"
          :markers="mapMarkers"
          :caption="`${spot.name} 주변`"
        />
      </aside>
    </div>
  </div>
</template>
