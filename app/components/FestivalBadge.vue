<script setup lang="ts">
import type { Festival } from '#shared/types/tour'

/**
 * 축제 — 열릴 때만 나타나는 헤더 아이콘 + 팝업
 *
 * **탭으로 만들지 않는다.** 레이아웃이 이미 같은 판단을 내려 뒀다("안내는 NAV에
 * 넣지 않는다. 목적지가 아니라 참고 자료이고, 넣으면 모바일 탭바가 4칸이 되어
 * 주 동선 셋이 좁아진다"). 축제는 그보다 더하다 — 안동 축제는 7건이고 대부분의
 * 날에 진행중이 0건이라, 탭을 주면 주 동선 하나를 내주고 빈 화면을 얻는다.
 *
 * 그래서 **데이터가 있을 때만 존재한다.** 없으면 아무것도 그리지 않는다.
 * 정류장을 확인하지 못한 관광지를 비워 두는 것과 같은 규칙이다. → ADR-035
 *
 * ⚠️ 축제가 없는 날에는 이 아이콘이 사라지므로, 화면 어디에도 "축제 데이터를
 *    쓴다"는 흔적이 남지 않는다. 그 사실은 `/about`의 데이터 출처가 상시로
 *    떠맡는다(→ `about.sourceFestivalTerm`). 기능이 조건부라고 출처까지
 *    조건부일 이유는 없다.
 *
 * 헤더에 두는 이유는 전역이기 때문이다. 홈에만 두면 공유 링크로 관광지 상세에
 * 바로 들어온 사람은 지금 축제가 열리는 줄 모른 채 화면을 닫는다.
 */
const t = useT()
const d = useDisplay()

/**
 * 이 fetch는 모든 페이지의 SSR에 얹힌다. 그래도 되는 근거:
 *   `/api/festivals`의 원본 목록은 1일 캐시되고(축제 등재는 월 단위로도 안 바뀐다)
 *   정류장 목록도 1일 캐시라, 따뜻할 때 추가 원격 호출이 0이다.
 *   판정만 요청 시점에 도는데 그건 날짜 비교 몇 줄이다.
 *
 * 실패해도 헤더가 죽으면 안 된다. `default`가 빈 배열이라 그때는 아이콘이 안 뜬다.
 * 축제를 못 불러온 것이 서비스 전체를 멈출 이유는 없다.
 */
const { data: festivals } = await useFetch<Festival[]>('/api/festivals', {
  default: () => [] as Festival[],
})

const hasFestival = computed(() => festivals.value.length > 0)

/** 하나라도 진행중이면 아이콘이 "지금"을 말한다. 아니면 "곧"이다. */
const anyOngoing = computed(() => festivals.value.some((festival) => festival.status === 'ongoing'))

const dialog = ref<HTMLDialogElement | null>(null)
const open = ref(false)

/**
 * 네이티브 `<dialog>`를 쓴다. 직접 만든 오버레이로는 공짜로 못 얻는 것들이 있다 —
 * Esc로 닫기, 배경 포커스 가두기, 뒤 콘텐츠를 보조기술에서 감추기(inert).
 * 축제 팝업 하나 만들자고 그것들을 손으로 다시 짜면 대개 절반쯤에서 멈춘다.
 */
function show() {
  open.value = true
  dialog.value?.showModal()
}

function hide() {
  dialog.value?.close()
}

/**
 * 팝업 안의 실시간 조회는 열려 있는 동안에만 산다. `open`이 false면
 * FestivalArrivals가 언마운트되어 닫아 둔 팝업이 버스 API를 부르지 않는다.
 */
function onClose() {
  open.value = false
}

/**
 * 배경(백드롭)을 누르면 닫는다. `<dialog>`는 백드롭 클릭을 자동으로 처리하지
 * 않으므로 직접 붙인다. 클릭 대상이 dialog 자신일 때만 닫는다 — 안쪽 내용을
 * 누른 것까지 닫으면 정류장 칩을 고르다 팝업이 사라진다.
 */
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) hide()
}

/** 축제마다 고른 승강장. 안 고르면 첫 번째(가장 가깝고 도착이 뜨는 쪽)다. */
const picked = ref<Record<string, number>>({})

function stationOf(festival: Festival) {
  const id = picked.value[festival.id]
  return festival.stations.find((station) => station.stationId === id) ?? festival.stations[0]
}

/**
 * 승강장 칩의 둘째 줄 — 이름이 같은 승강장을 가르는 자리
 *
 * 홈의 `stationTag`와 같은 규칙이다. 방면이 있으면 방면, 없으면 거리만.
 * 기·종점 승강장은 방면 대신 "도착 정보 없음"을 먼저 말한다 — 고르기 전에
 * 알아야 하는 사실이라 거리보다 앞선다. → ADR-015
 */
function stationChipTag(station: Festival['stations'][number]): string {
  if (station.terminusOnly) return t.value.home.terminusTag

  const distance = formatDistance(station.distance, d.locale.value)
  return station.direction
    ? `${t.value.home.directionTag(station.direction)} · ${distance}`
    : distance
}

/**
 * 기간 아래 한 줄 — 오늘 기준으로 무엇을 말해야 하는가
 *
 * 서버가 판정한 status와 남은 날만 읽는다. 여기서 날짜를 다시 계산하지 않는다.
 * 브라우저 시각으로 재판정하면 기기 시계가 틀어진 사람에게만 다른 답이 나온다.
 */
function when(festival: Festival): string {
  if (festival.status === 'ongoing') {
    if (festival.daysUntilEnd === 0) return t.value.festival.lastDay
    return `${t.value.festival.now} · ${t.value.festival.endsIn(festival.daysUntilEnd)}`
  }
  if (festival.daysUntilStart === 1) return t.value.festival.startsTomorrow
  return t.value.festival.startsIn(festival.daysUntilStart)
}
</script>

<template>
  <!-- 축제가 없으면 이 자리에 아무것도 없다. 빈 아이콘을 남기지 않는다. -->
  <template v-if="hasFestival">
    <button
      type="button"
      :aria-label="t.festival.iconLabel(festivals.length)"
      class="flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-medium transition-colors tablet:px-3"
      :class="
        anyOngoing
          ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
          : 'border-hairline text-muted hover:bg-surface-soft'
      "
      @click="show()"
    >
      <!-- 탈춤 가면을 닮은 표식. 안동에서 축제라는 말이 가리키는 그것이다. -->
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        class="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <path d="M5 5.5c4.5-1.2 9.5-1.2 14 0 .4 5.6-1.1 10.4-4.6 13.1a4 4 0 0 1-4.8 0C6.1 15.9 4.6 11.1 5 5.5z" />
        <path d="M9 10.5h1.5M13.5 10.5H15" stroke-linecap="round" />
        <path d="M10 14.8c1.3.7 2.7.7 4 0" stroke-linecap="round" />
      </svg>

      <span>{{ anyOngoing ? t.festival.chipNow : t.festival.chipSoon }}</span>

      <!--
        진행중일 때만 점을 찍는다. "곧 열려요"에까지 찍으면 지금 열리는 것과
        구분이 사라지고, 그러면 점이 아무 말도 안 하게 된다.
      -->
      <span v-if="anyOngoing" class="h-1.5 w-1.5 flex-none rounded-full bg-primary" />
    </button>

    <dialog
      ref="dialog"
      class="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-md border border-hairline bg-white p-0 text-ink shadow-float backdrop:bg-ink/40"
      @close="onClose()"
      @click="onBackdrop($event)"
    >
      <!-- 열려 있을 때만 내용을 만든다. 닫힌 팝업이 버스 API를 부르지 않게 한다. -->
      <div v-if="open" class="max-h-[80vh] overflow-y-auto">
        <div
          class="sticky top-0 flex items-start justify-between gap-3 border-b border-hairline-soft bg-white px-6 pb-4 pt-6"
        >
          <div class="min-w-0">
            <h2 class="text-[22px] font-medium leading-tight tracking-[-0.44px]">
              {{ t.festival.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ anyOngoing ? t.festival.subOngoing : t.festival.subUpcoming }}
            </p>
          </div>
          <button
            type="button"
            class="-mr-2 -mt-1 flex-none rounded-full px-3 py-2 text-sm font-medium text-muted hover:bg-surface-soft"
            @click="hide()"
          >
            {{ t.festival.close }}
          </button>
        </div>

        <section
          v-for="festival in festivals"
          :key="festival.id"
          class="border-b border-hairline-soft px-6 py-5 last:border-b-0"
        >
          <div class="flex items-start gap-4">
            <span class="block h-16 w-16 flex-none overflow-hidden rounded-sm">
              <SpotPhoto :src="festival.imageUrl" :alt="d.name(festival)" />
            </span>
            <div class="min-w-0 flex-1">
              <b class="block text-base font-semibold leading-tight">{{ d.name(festival) }}</b>
              <p class="mt-1 text-sm text-muted">
                {{ t.festival.period(festival.startDate, festival.endDate) }}
              </p>
              <p
                class="mt-0.5 text-[13px] font-medium"
                :class="festival.status === 'ongoing' ? 'text-primary' : 'text-muted-soft'"
              >
                {{ when(festival) }}
              </p>
            </div>
          </div>

          <p v-if="festival.address" class="mt-3 text-[13px] leading-relaxed text-muted">
            {{ festival.address }}
          </p>

          <!--
            여기가 이 팝업이 축제 목록이 아니라 이 서비스의 화면인 이유다.
            축제 이름과 날짜는 어디에나 있다. "그래서 어느 버스를 타느냐"에
            답하는 곳이 없어서 이 서비스를 만들었다. → ADR-012
          -->
          <div class="mt-4">
            <h3 class="text-[13px] font-semibold text-muted">{{ t.festival.stationsHead }}</h3>

            <p v-if="!festival.stations.length" class="mt-2 text-sm text-muted">
              {{ t.festival.noStation }}
            </p>

            <template v-else>
              <!-- 승강장이 둘 이상일 때만 고르게 한다. 하나뿐이면 고를 것이 없다. -->
              <div v-if="festival.stations.length > 1" class="mt-2 flex gap-2 overflow-x-auto">
                <button
                  v-for="station in festival.stations"
                  :key="station.stationId"
                  type="button"
                  class="flex-none rounded-full border px-3 py-1.5 text-left text-[13px] font-medium transition-colors"
                  :class="[
                    station.stationId === stationOf(festival)?.stationId
                      ? 'border-ink bg-ink text-white'
                      : 'border-hairline text-body hover:bg-surface-soft',
                    station.terminusOnly && station.stationId !== stationOf(festival)?.stationId
                      ? 'opacity-60'
                      : '',
                  ]"
                  @click="picked[festival.id] = station.stationId"
                >
                  <span class="block whitespace-nowrap">{{ d.stationName(station) }}</span>
                  <!--
                    방면이 이름을 가른다. 실측에서 '탈춤공원건너'와 '탈춤공원앞'은
                    영문명이 둘 다 'Talchum gong-won'이고 거리도 1m 차이라, 이 줄이
                    없으면 영문 화면에서 같은 칩이 두 개 나란히 선다. 홈과 같은 처방이다.
                  -->
                  <span class="mt-0.5 block whitespace-nowrap text-xs font-normal opacity-70">
                    {{ stationChipTag(station) }}
                  </span>
                </button>
              </div>

              <template v-if="stationOf(festival)">
                <p class="mt-2 text-sm text-muted">
                  <b class="font-medium text-ink">{{ d.stationName(stationOf(festival)!) }}</b>
                  ·
                  {{ formatDistance(stationOf(festival)!.distance, d.locale.value) }}
                  ·
                  {{ t.common.minutesWalk(stationOf(festival)!.walkMinutes) }}
                </p>

                <p v-if="stationOf(festival)!.terminusOnly" class="mt-1 text-[13px] text-muted-soft">
                  {{ t.home.terminusTag }}
                </p>

                <!-- 승강장을 바꾸면 조회도 바뀌어야 한다. key로 다시 마운트한다. -->
                <FestivalArrivals
                  :key="stationOf(festival)!.stationId"
                  :station-id="stationOf(festival)!.stationId"
                  class="mt-1"
                />

                <!--
                  목적지는 정류장이 아니라 축제장이다. 이름도 축제 이름을 국문
                  그대로 넘긴다 — 배경 지도가 국문이라 영문 이름을 실어 보내면
                  지도에 적힌 지명과 어긋난다. → MapCard의 같은 판단
                -->
                <a
                  :href="kakaoDirectionsUrl(festival.name, festival.lat, festival.lng)"
                  target="_blank"
                  rel="noopener"
                  class="mt-3 inline-block text-sm font-medium underline"
                >
                  {{ t.spot.directions }}
                </a>
              </template>

              <!--
                계산으로 구한 정류장이라고 적는다. 관광지 버스 안내는 사람이
                확인한 매핑이고 이건 아니다. 근거가 다르면 다르다고 말한다.
              -->
              <p class="mt-3 text-[13px] leading-relaxed text-muted-soft">
                {{ t.festival.stationNote }}
              </p>
            </template>
          </div>
        </section>

        <p class="px-6 pb-6 text-[13px] text-muted-soft">{{ t.festival.source }}</p>
      </div>
    </dialog>
  </template>
</template>
