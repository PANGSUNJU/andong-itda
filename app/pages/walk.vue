<script setup lang="ts">
import type { SpotBusInfo, SpotRouteInfo } from '#shared/types/static-data'
import type { WalkArea } from '#shared/types/tour'
import { COURSES, type Course } from '~/data/courses'

/**
 * 걷는 길 — 버스 없이 걸어서 이어지는 코스
 *
 * 코스 자체는 정적이라 상류 장애의 영향을 받지 않는다. 버스가 끊긴 시간대에
 * 여행자에게 남는 유일한 선택지이기도 하다.
 *
 * ⚠️ 그렇다고 버스와 무관한 화면은 아니었다. 세 탭 중 여기만 버스와 이어져 있지
 *    않아서, "버스를 기다리는 시간에 다녀올 곳을 알려준다"는 이 서비스의 조직
 *    원리가 이 화면에서만 빠져 있었다(ADR-012). 걸어서 이어지는 길이라도
 *    **시작점까지는 타고 가야 하고 끝점에서는 타고 돌아와야 한다.** → ADR-038
 *
 * 코스는 그대로 뜬다. 버스 줄만 붙거나 안 붙는다 — 상류가 죽어도 걷는 길은 남는다.
 */
const t = useT()
const d = useDisplay()
const locale = useLocale()

usePageTitle(() => t.value.walk.title)

/** 코스의 시작·끝. 월영교는 두 코스가 공유하므로 한 번만 부른다. */
const routeNames = [...new Set(COURSES.flatMap((course) => [course.start, course.end]))]
const endNames = [...new Set(COURSES.map((course) => course.end))]

/**
 * 노선과, 끝점의 경고를 함께 받는다.
 *
 * 끝점은 `/api/spot-bus`도 부른다. 거기에만 있는 것이 하나 있어서다 — 사람이
 * 확인한 시간표에서 나온 **경고 문장**. 월영교가 그 경우다. "야경 명소이지만
 * 막차가 18:45다"는 밤 코스에 반드시 붙어야 하는 문장인데, 노선 데이터에는 없다.
 *
 * 404는 오류가 아니다. 사람이 확인한 관광지 7곳에만 있는 정보이므로,
 * 없으면 그 줄을 그리지 않는다. → ADR-016
 */
const { data: bus } = await useAsyncData(
  'walk-bus',
  async () => {
    const [routes, ends] = await Promise.all([
      Promise.all(
        routeNames.map(async (name) => {
          try {
            return [
              name,
              await $fetch<SpotRouteInfo>(`/api/spot-routes/${encodeURIComponent(name)}`),
            ] as const
          } catch {
            return [name, null] as const
          }
        }),
      ),
      Promise.all(
        endNames.map(async (name) => {
          try {
            return [
              name,
              await $fetch<SpotBusInfo>(`/api/spot-bus/${encodeURIComponent(name)}`),
            ] as const
          } catch {
            return [name, null] as const
          }
        }),
      ),
    ])

    return {
      routes: Object.fromEntries(routes) as Record<string, SpotRouteInfo | null>,
      ends: Object.fromEntries(ends) as Record<string, SpotBusInfo | null>,
    }
  },
  { default: () => ({ routes: {}, ends: {} }) },
)

/** 시작점까지 타고 갈 대표 노선. 목록이 덜 걷는 순이라 첫 번째가 그것이다. */
function toStart(course: Course) {
  return bus.value.routes[course.start]?.inbound[0]
}

/** 끝점에서 시내로 나가는 노선 번호. 하차 정류장은 갈 때와 같으므로 번호만 말한다. */
function toTown(course: Course) {
  return [...new Set(bus.value.routes[course.end]?.outbound.map((r) => r.routeNum) ?? [])]
}

/**
 * 끝점의 경고 — 이 화면에서 가장 값이 큰 한 줄
 *
 * `달빛 물길`은 "해 지면 조명이 켜져요"로 끝나는데 월영교 막차가 18:45다.
 * 그동안 이 화면은 **돌아올 수 없는 밤 코스를 안내하고 있었다.**
 */
function endWarning(course: Course) {
  const info = bus.value.ends[course.end]
  return info ? d.pick(info.warning, info.warningEn) : null
}

/**
 * 걸어서 이어지는 동네 — 좌표가 지지하는 묶음
 *
 * 위의 코스 2개는 손으로 짠 것이라 순서와 소요 시간을 말한다. 이쪽은 안 한다 —
 * 좌표가 말하는 것은 "이것들이 가깝다"까지다. 두 목록을 나란히 두되 그 차이가
 * 문구와 생김새에서 읽히게 한다. → ADR-043
 */
const { data: areas } = await useFetch<WalkArea[]>('/api/walk-areas', { default: () => [] })

/** 카드에 이름을 늘어놓을 개수. 나머지는 "외 N곳"으로 접는다. */
const AREA_NAMES_SHOWN = 6

/**
 * 지도는 **하나만** 둔다.
 *
 * 묶음마다 지도를 넣으면 카카오맵 인스턴스가 12개가 되고 화면이 그만큼 무거워진다.
 * 묶음의 중심을 점 하나로 찍으면 "안동 어디에 흩어져 있는가"라는, 이 목록에서
 * 지도가 답해야 할 유일한 질문에 답이 된다.
 */
const areaMarkers = computed(() =>
  areas.value.map((area) => ({
    name: area.anchor,
    lat: area.places.reduce((sum, place) => sum + place.lat, 0) / area.places.length,
    lng: area.places.reduce((sum, place) => sum + place.lng, 0) / area.places.length,
  })),
)
</script>

<template>
  <div class="mx-auto max-w-[1080px] px-6 pb-12">
    <div class="py-6 pb-4">
      <h1 class="font-serif text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        {{ t.walk.heading }}
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        {{ t.walk.sub }}
      </p>
    </div>

    <article
      v-for="course in COURSES"
      :key="course.id"
      class="mb-4 overflow-hidden rounded-md border border-hairline"
    >
      <div class="p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-serif text-xl font-semibold leading-tight tracking-[-0.18px]">
              {{ course.title[locale] }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ t.walk.summary(course.distanceKm, course.minutes, course.terrain[locale]) }}
            </p>
          </div>
          <span
            class="flex-none rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold"
          >
            {{ course.timeOfDay[locale] }}
          </span>
        </div>

        <ol class="mt-4">
          <li v-for="(step, index) in course.steps" :key="step.name" class="flex items-start gap-3">
            <span class="flex w-3.5 flex-none flex-col items-center self-stretch">
              <span class="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />
              <span
                v-if="index < course.steps.length - 1"
                class="min-h-[18px] w-[1.5px] flex-1 bg-hairline"
              />
            </span>
            <span class="block pb-4">
              <!-- 지명은 두 언어에서 같다. 확인하지 못한 영문명을 지어내지 않는다. → ADR-030 -->
              <b class="block text-base font-normal leading-relaxed">{{ step.name }}</b>
              <span class="block text-sm leading-relaxed text-muted">{{ step.detail[locale] }}</span>
            </span>
          </li>
        </ol>

        <!--
          버스로 오가기 — 걷는 길이 서비스의 조직 원리로 돌아오는 자리

          문구는 관광지 상세와 같은 사전(`spotRoutes`)을 쓴다. 같은 사실을 두 화면이
          다른 말로 하면 읽는 사람이 다른 것으로 읽는다.
        -->
        <div class="border-t border-hairline-soft pt-4">
          <b class="block text-[13px] font-semibold text-muted">{{ t.walk.busHead }}</b>

          <dl class="mt-1.5 text-sm">
            <div class="flex gap-3 py-1">
              <dt class="w-11 flex-none text-muted">{{ t.walk.goLabel }}</dt>
              <dd v-if="toStart(course)" class="min-w-0 leading-relaxed">
                <b class="font-semibold">
                  {{ t.spotRoutes.routeLabel(toStart(course)!.routeNum) }}
                </b>
                ·
                {{
                  t.spotRoutes.getOff(
                    d.stationName({
                      stationNm: toStart(course)!.stationNm,
                      nameEn: toStart(course)!.stationNmEn,
                    }),
                  )
                }}
                ·
                {{ t.spotRoutes.thenWalk(formatDistance(toStart(course)!.walkMeters, d.locale.value)) }}
              </dd>
              <dd v-else class="text-muted">{{ t.walk.startUnknown }}</dd>
            </div>

            <div class="flex gap-3 py-1">
              <dt class="w-11 flex-none text-muted">{{ t.walk.backLabel }}</dt>
              <dd v-if="toTown(course).length" class="min-w-0 leading-relaxed">
                {{ t.walk.backFrom(course.end) }}
                <b class="font-semibold">
                  {{ toTown(course).map((num) => t.spotRoutes.routeLabel(num)).join(' · ') }}
                </b>
              </dd>
              <!-- 갈 수는 있는데 못 돌아오는 안내가 이 서비스에서 가장 위험하다. → ADR-016 -->
              <dd v-else class="text-primary">{{ t.walk.returnUnknown }}</dd>
            </div>
          </dl>

          <!--
            끝점의 경고. 밤 코스에 "막차가 18:45다"가 붙는 자리다.
            이 한 줄이 이 화면에서 가장 값이 크다.
          -->
          <p v-if="endWarning(course)" class="mt-2 text-[13px] leading-relaxed text-primary">
            {{ endWarning(course) }}
          </p>

          <!-- 근거를 밝힌다. 관광지 상세와 같은 문장을 쓴다. -->
          <p class="mt-2 text-[13px] leading-relaxed text-muted-soft">{{ t.spotRoutes.note }}</p>
        </div>

        <div
          class="mt-4 flex flex-wrap gap-6 border-t border-hairline-soft pt-4 text-sm text-muted"
        >
          <span v-for="caution in course.cautions" :key="caution.ko">{{ caution[locale] }}</span>
        </div>
      </div>
    </article>

    <!--
      출처를 밝힌다. 위의 코스 2개만 우리가 만든 것이라, 같은 얼굴로 두면
      어디서 온 정보인지 알 수 없다. 아래 "동네"는 공공데이터 좌표에서 나온다.
      두루누비 API는 코리아둘레길 144코스뿐이라 내륙인 안동이 없다. → ADR-008
    -->
    <p class="text-[13px] leading-relaxed text-muted">
      {{ t.walk.noticeConstruction }}<br />
      {{ t.walk.noticeSource }}
    </p>

    <!--
      걸어서 이어지는 동네 — 코스가 아니다

      위의 코스와 생김새를 일부러 다르게 뒀다. 저쪽은 점과 선으로 순서를 그리고
      이쪽은 이름을 늘어놓기만 한다. 순서를 주장하지 않는다는 사실이 화면에서
      읽혀야 하기 때문이다. → ADR-043
    -->
    <section v-if="areas.length" class="mt-12">
      <div class="mb-4">
        <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
          {{ t.walk.areasHead }}
        </h2>
        <p class="mt-1 text-sm leading-relaxed text-muted">{{ t.walk.areasSub }}</p>
      </div>

      <!--
        가로로 길고 세로로 짧은 상자에 안동시 전체(29×33km)를 담으면 세로가 먼저 막혀
        축척이 세 단계 밀린다 — 260px에서는 세종과 동해까지 들어왔다. 데스크톱에서만
        키워 정사각형에 가깝게 만든다. 좁은 화면은 상자도 좁아서 이미 세로가 맞는다.
      -->
      <MapCard
        class="mb-4"
        height="clamp(260px, 46vw, 420px)"
        :markers="areaMarkers"
        :caption="t.walk.areasMapCaption(areas.length)"
      />

      <div class="grid gap-3 tablet:grid-cols-2">
        <article
          v-for="area in areas"
          :key="area.id"
          class="rounded-md border border-hairline p-5"
        >
          <h3 class="text-base font-semibold leading-tight">{{ area.anchor }}</h3>
          <p class="mt-1 text-[13px] text-muted">
            {{ t.walk.areaSummary(area.places.length, formatDistance(area.spanMeters, d.locale.value)) }}
          </p>

          <!--
            지점 이름은 상류가 준 국문 그대로다. 확인하지 못한 영문명을 지어내지
            않는다 — 현장 표지판이 국문이다. → ADR-030
          -->
          <p class="mt-3 text-sm leading-relaxed text-body">
            {{ area.places.slice(0, AREA_NAMES_SHOWN).map((place) => place.name).join(' · ') }}
            <span v-if="area.places.length > AREA_NAMES_SHOWN" class="text-muted">
              {{ t.walk.areaMore(area.places.length - AREA_NAMES_SHOWN) }}
            </span>
          </p>

          <!-- 어떻게 가는가. 이게 없으면 이 목록은 그냥 지명 나열이다. -->
          <p v-if="area.station" class="mt-3 border-t border-hairline-soft pt-3 text-[13px] text-muted">
            {{
              t.walk.areaStation(
                d.stationName({ stationNm: area.station.stationNm, nameEn: area.station.nameEn }),
                formatDistance(area.station.distance, d.locale.value),
                area.station.walkMinutes,
              )
            }}
          </p>
        </article>
      </div>

      <p class="mt-4 text-[13px] leading-relaxed text-muted-soft">{{ t.walk.areasNote }}</p>
    </section>
  </div>
</template>
