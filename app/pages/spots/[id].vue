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

const t = useT()
const d = useDisplay()
const localePath = useLocalePath()

const { data: spots } = await useFetch<Spot[]>('/api/spots', { default: () => [] })

const spot = computed(() => spots.value.find((candidate) => candidate.id === id.value))

if (!spot.value) {
  throw createError({ statusCode: 404, statusMessage: t.value.spot.notFound, fatal: true })
}

usePageTitle(() => t.value.spot.title(spot.value ? d.name(spot.value) : ''))

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
  // 지도 위 이름은 국문 그대로다. 배경 지도가 국문이라 여기만 영문으로 인쇄하면
  // 지도에 적힌 지명과 어긋난다. → MapCard
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
      <NuxtLink :to="localePath('/browse')" class="text-sm text-muted underline">
        {{ t.spot.back }}
      </NuxtLink>
      <h1 class="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        {{ d.name(spot) }}
      </h1>
      <!--
        이름은 한 줄이다. 반대편 언어를 아래 붙이지 않는다 — 영문 화면에서
        국문 이름이 보이는 것은 상류에 영문이 없을 때뿐이다. → ADR-032
      -->
      <!-- 주소는 국문만 있다. 상류에 영문 주소가 없어 번역하지 않는다. -->
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        <template v-if="spot.rank">{{ t.spot.rankLine(spot.rank) }} · </template>
        {{ d.category(spot.category) }}
        <template v-if="spot.address"> · {{ spot.address }}</template>
      </p>
    </div>

    <div class="aspect-[4/3] overflow-hidden rounded-md tablet:aspect-[16/7]">
      <SpotPhoto :src="spot.imageUrl" :alt="d.name(spot)" />
    </div>

    <div class="mt-8 desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0 pb-12">
        <!--
          설명은 상류(한국관광공사)가 국문으로만 준다. 영문 화면에서도 국문 그대로다.
          기계로 옮겨 지어내지 않는다 — 없는 것은 없는 대로 둔다. → ADR-030
        -->
        <section v-if="spot.description" class="pb-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
            {{ t.spot.aboutHead }}
          </h2>
          <p class="text-base leading-relaxed text-body">{{ spot.description }}</p>
        </section>

        <section class="border-t border-hairline py-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
            {{ t.spot.accessHead }}
          </h2>

          <template v-if="bus">
            <p class="text-base leading-relaxed text-body">
              {{ t.spot.getOffBefore
              }}<b class="font-semibold">{{
                bus.inbound
                  ? d.stationName({
                      stationNm: bus.inbound.stationNm,
                      nameEn: bus.inbound.stationNmEn,
                    })
                  : t.bus.stationUnknown
              }}</b
              >{{ t.spot.getOffAfter }}
              <template v-if="bus.schedule.departFirst">
                {{
                  t.spot.schedule(
                    bus.schedule.outboundFrom ?? t.bus.downtown,
                    bus.schedule.departFirst,
                    bus.schedule.departLast ?? '—',
                  )
                }}
              </template>
            </p>
            <p v-if="!bus.schedule.returnTimesKnown" class="mt-3 text-base leading-relaxed text-body">
              {{ t.spot.returnUnknownLead }}
              <b class="font-semibold">{{ t.spot.returnUnknownStrong }}</b>
            </p>
          </template>

          <p v-else class="text-base leading-relaxed text-body">
            <template v-if="busPending">{{ t.spot.busPendingBody }}</template>
            <template v-else>{{ t.spot.busNoneBody }}</template>
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
            {{ t.spot.directions }}
          </a>
        </section>

        <section v-if="around.length" class="border-t border-hairline py-8">
          <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
            {{ t.spot.aroundHead }}
          </h2>
          <div class="flex flex-col">
            <NuxtLink
              v-for="candidate in around"
              :key="candidate.id"
              :to="localePath(`/spots/${candidate.id}`)"
              class="flex w-full items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0"
            >
              <span class="block h-14 w-14 flex-none overflow-hidden rounded-sm">
                <SpotPhoto :src="candidate.imageUrl" :alt="d.name(candidate)" />
              </span>
              <span class="min-w-0 flex-1">
                <b class="block truncate text-base font-medium leading-tight">
                  {{ d.name(candidate) }}
                </b>
                <span class="mt-0.5 block truncate text-sm text-muted">
                  {{ formatDistance(candidate.distance ?? 0, d.locale.value) }} ·
                  {{ t.common.minutesWalk(candidate.walkMinutes ?? 0) }}
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
          <p class="text-base font-medium">{{ t.spot.panelPendingTitle }}</p>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            <template v-if="busPending">{{ t.spot.panelPendingBody }}</template>
            <template v-else>{{ t.spot.panelNoneBody }}</template>
          </p>
        </div>

        <MapCard
          class="mt-4"
          height="240px"
          :center="{ lat: spot.lat, lng: spot.lng }"
          :markers="mapMarkers"
          :caption="t.spot.mapCaption(d.name(spot))"
        />
      </aside>
    </div>
  </div>
</template>
