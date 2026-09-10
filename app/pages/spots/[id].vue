<script setup lang="ts">
import { NuxtLink } from '#components'

import type { RelatedSpot, Spot } from '#shared/types/tour'
import type { SpotBusInfo, SpotRouteInfo } from '#shared/types/static-data'
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
 * 노선 안내는 44곳 전부에 답한다.
 *
 * 위의 `/api/spot-bus`는 사람이 확인한 7곳에만 200을 준다. 나머지 37곳에서
 * "가는 방법" 자리가 "버스 정보가 등록되지 않은 곳이에요" 한 줄로 끝나던 것을
 * 이 요청이 메운다. 근거가 다르므로 엔드포인트도 화면 문구도 따로 둔다.
 *
 * 두 요청이 서로를 기다리지 않는다. 하나가 실패해도 다른 하나는 뜬다.
 */
const { data: routes } = await useFetch<SpotRouteInfo>(
  () => `/api/spot-routes/${encodeURIComponent(spot.value!.name)}`,
)

/** "가는 방법" 첫 문장이 쓸 대표 노선. 가장 덜 걷는 것이 맨 앞이다. */
const mainRoute = computed(() => routes.value?.inbound[0])

/**
 * 함께 많이 찾는 곳 — 방문 데이터가 고른 곳
 *
 * 아래 "근처에 함께 볼 곳"은 **거리**로 고른다. 이건 **행동**으로 고른다.
 * 가깝다고 같이 보는 것은 아니고, 멀어도 같이 본다. 두 질문이 다르므로
 * 두 목록을 둔다. → ADR-042
 *
 * 데이터가 없으면 빈 배열이 온다(44곳 중 21곳에만 있다). 404가 아니다.
 */
const { data: related } = await useFetch<RelatedSpot[]>(
  () => `/api/spot-related/${id.value}`,
  { default: () => [] },
)

/**
 * 상류가 준 코드를 우리 목록에서 찾는다. **이름으로 잇지 않는다** — 그 코드가
 * 곧 우리 `id`다. 못 찾으면 링크 없이 이름만 보여준다. 호텔·식당처럼 우리가
 * 상세를 갖지 않는 곳도 방문 데이터에는 있고, 그것도 여행자에게는 정보다.
 */
const relatedShown = computed(() =>
  related.value.slice(0, 5).map((item) => ({
    ...item,
    spot: spots.value.find((candidate) => candidate.id === item.id),
  })),
)

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
    spots.value.filter(
      (candidate) =>
        candidate.id !== id.value &&
        // 위 목록에 이미 있는 곳은 뺀다. 같은 곳이 한 화면에 두 번 나오면
        // 두 목록이 서로 다른 일을 한다는 것이 안 읽힌다.
        !relatedShown.value.some((item) => item.id === candidate.id),
    ),
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
      <h1 class="mt-2 font-serif text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
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
          <h2 class="mb-3 font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
            {{ t.spot.aboutHead }}
          </h2>
          <p class="text-base leading-relaxed text-body">{{ spot.description }}</p>
        </section>

        <section class="border-t border-hairline py-8">
          <h2 class="mb-3 font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
            {{ t.spot.accessHead }}
          </h2>

          <!--
            노선 문장이 맨 앞이다. 시간표보다 먼저 알아야 하는 것이 "몇 번을 타는가"인데,
            예전에는 그 문장이 어디에도 없었다 — 확인된 7곳조차 정류장 이름과 첫차·막차만
            말하고 노선 번호는 말하지 않았다.
          -->
          <p v-if="mainRoute" class="text-base leading-relaxed text-body">
            <b class="font-semibold">{{ t.spotRoutes.routeLabel(mainRoute.routeNum) }}</b
            >{{ t.spot.rideAnd }}<b class="font-semibold">{{
              d.stationName({ stationNm: mainRoute.stationNm, nameEn: mainRoute.stationNmEn })
            }}</b
            >{{ t.spot.getOffAfter }}
            {{
              t.spot.fromDowntown(
                mainRoute.stops,
                formatDistance(mainRoute.roadMeters, d.locale.value),
              )
            }}
          </p>

          <!-- 시내와 안 닿는 4곳. "정보 없음"이 아니라 "갈아타야 한다"가 답이다. -->
          <p v-else-if="routes?.disconnected" class="text-base leading-relaxed text-body">
            {{ t.spotRoutes.disconnectedTitle }}. {{ t.spotRoutes.disconnectedBody }}
          </p>

          <template v-if="bus">
            <p class="mt-3 text-base leading-relaxed text-body">
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

          <!-- 노선도 못 찾고 확인된 매핑도 없을 때만 남는 문장이다. -->
          <p v-else-if="!mainRoute && !routes?.disconnected" class="text-base leading-relaxed text-body">
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

        <!--
          함께 많이 찾는 곳 — 방문 데이터

          아래 "근처에 함께 볼 곳"과 생김새를 일부러 다르게 둔다. 저쪽은 사진과
          거리가 붙고 이쪽은 이름과 분류만 붙는다. 둘 다 장소 목록이라 같은 모양이면
          왜 두 번 나오는지가 안 읽힌다. 근거가 다르면 얼굴도 달라야 한다.
        -->
        <section v-if="relatedShown.length" class="border-t border-hairline py-8">
          <h2 class="mb-3 font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
            {{ t.spot.relatedHead }}
          </h2>

          <div class="flex flex-col">
            <component
              :is="item.spot ? NuxtLink : 'div'"
              v-for="item in relatedShown"
              :key="item.id"
              :to="item.spot ? localePath(`/spots/${item.id}`) : undefined"
              class="flex w-full items-baseline gap-3 border-b border-hairline-soft py-2.5 last:border-b-0"
            >
              <!-- 우리 목록에 있으면 그 이름을 쓴다. 영문 화면에서 영문명이 붙는다. -->
              <b class="min-w-0 flex-1 truncate text-base font-medium leading-tight">
                {{ item.spot ? d.name(item.spot) : item.name }}
              </b>
              <span class="flex-none text-sm text-muted">{{ d.category(item.category) }}</span>
            </component>
          </div>

          <p class="mt-3 text-[13px] leading-relaxed text-muted-soft">{{ t.spot.relatedNote }}</p>
        </section>

        <section v-if="around.length" class="border-t border-hairline py-8">
          <h2 class="mb-3 font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
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
        <!--
          실시간 카드는 승강장을 확정한 7곳에만 뜬다. 없을 때 자리를 비우지 않고
          아래 노선 카드가 받는다. 예전에는 여기 "버스 안내 준비 중"만 남았다.
        -->
        <SpotBusPanel
          v-if="bus"
          :info="bus"
          :updated-at="updatedAt"
          :pending="busRequestPending"
          @refresh="refreshNow()"
        />

        <!--
          노선 카드는 44곳 전부에 뜬다. 실시간 카드가 있는 곳에서도 함께 둔다 —
          "몇 분 후"와 "몇 번을 타는가"는 다른 질문이고, 후자는 그 카드에 없었다.
        -->
        <SpotRoutePanel v-if="routes" :info="routes" :class="bus ? 'mt-4' : ''" />

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
