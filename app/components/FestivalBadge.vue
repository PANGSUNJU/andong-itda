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
  lockScroll()
}

/**
 * 닫는 길이 셋이다 — X 버튼 · 백드롭 · Esc. Esc는 `@cancel`로 이리 들어온다.
 *
 * ⚠️ 잠금 해제를 close 이벤트 하나에만 걸지 않는다. 여기서도 한 번 푼다.
 *    두 번 풀어도 아무 일이 없고(unlockScroll이 잠긴 상태만 되돌린다), 한 번도
 *    안 풀리면 페이지 전체가 굳는다. 값이 다른 두 실패의 비용이다.
 */
function hide() {
  dialog.value?.close()
  unlockScroll()
}

/** 닫히면 내용도 언마운트한다. 닫아 둔 팝업이 아무것도 붙들고 있지 않게 한다. */
function onClose() {
  open.value = false
  unlockScroll()
}

/**
 * 뒤 화면을 붙든다 — `showModal()`이 해 주지 않는 하나
 *
 * 네이티브 `<dialog>`는 Esc·포커스 가두기·inert를 공짜로 주지만 **배경 스크롤은
 * 막지 않는다.** 팝업 위에서 휠을 굴리면 목록 끝에서 스크롤이 뒤 페이지로 넘어가고,
 * 닫고 나면 읽던 자리가 아니라 엉뚱한 곳에 서 있게 된다.
 *
 * ⚠️ `overflow: hidden`을 쓰지 않았다. 그 방법은 **iOS 사파리에서 듣지 않는다** —
 *    이 서비스는 버스를 기다리며 휴대폰으로 보는 화면이라 그게 주 환경이다.
 *    본문을 통째로 `position: fixed`로 띄우면 스크롤할 것 자체가 없어진다.
 *
 * 대신 두 가지를 되돌려 줘야 한다.
 *   1. 있던 자리 — 띄우는 순간 맨 위로 튄다. 음수 `top`으로 붙잡았다가 풀 때 되돌린다.
 *   2. 스크롤바 폭 — 사라지면서 화면이 그만큼 오른쪽으로 튄다. 패딩으로 메운다.
 */
let lockedY = 0

function lockScroll() {
  const body = document.body
  lockedY = window.scrollY
  const gap = window.innerWidth - document.documentElement.clientWidth

  body.style.position = 'fixed'
  body.style.top = `-${lockedY}px`
  body.style.left = '0'
  body.style.right = '0'
  if (gap > 0) body.style.paddingRight = `${gap}px`
}

function unlockScroll() {
  const body = document.body
  // 잠기지 않았는데 풀면 `scrollTo(0, 0)`이 사람을 맨 위로 보낸다.
  if (body.style.position !== 'fixed') return

  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.right = ''
  body.style.paddingRight = ''
  window.scrollTo(0, lockedY)
}

// 팝업이 열린 채로 화면을 떠나는 경로가 있다(길찾기 링크·뒤로가기). 잠금을 두고 가면 페이지가 굳는다.
onUnmounted(unlockScroll)

/**
 * 배경(백드롭)을 누르면 닫는다. `<dialog>`는 백드롭 클릭을 자동으로 처리하지
 * 않으므로 직접 붙인다. 클릭 대상이 dialog 자신일 때만 닫는다 — 안쪽 내용을
 * 누른 것까지 닫으면 글자를 긁다가 팝업이 사라진다.
 */
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) hide()
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
      @cancel="hide()"
      @click="onBackdrop($event)"
    >
      <!-- 열려 있을 때만 내용을 만든다. 닫힌 팝업이 버스 API를 부르지 않게 한다. -->
      <div v-if="open" class="max-h-[80vh] overflow-y-auto">
        <div
          class="sticky top-0 flex items-start justify-between gap-3 border-b border-hairline-soft bg-white px-6 pb-4 pt-6"
        >
          <div class="min-w-0">
            <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
              {{ t.festival.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ anyOngoing ? t.festival.subOngoing : t.festival.subUpcoming }}
            </p>
          </div>
          <!--
            낱말이 아니라 ×다. 제목 옆에 "닫기"가 글자로 있으면 그것도 읽을 것이
            하나 더 있는 것처럼 보인다. 낱말은 aria-label로 남으므로 화면 낭독기는
            그대로 "닫기"를 읽는다 — 문구는 지우지 않고 자리만 옮긴 것이다.
          -->
          <button
            type="button"
            :aria-label="t.festival.close"
            class="-mr-2 -mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-ink"
            @click="hide()"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              class="h-[18px] w-[18px]"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
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
            목적지는 축제장이다. 이름도 축제 이름을 국문 그대로 넘긴다 —
            배경 지도가 국문이라 영문 이름을 실어 보내면 지도에 적힌 지명과
            어긋난다. → MapCard의 같은 판단

            ⚠️ 여기 "가까운 정류장"이 있었다. 축제장 좌표에서 최근접 승강장 셋을
               계산해 실시간 도착까지 붙였는데, 그 계산이 **승강장을 가르지
               못했다** — 탈춤페스티벌의 1·2위가 97m와 98m이고 영문명이 둘 다
               'Talchum gong-won'이었다. 고르라고 내밀 수 있는 정보가 아니었다.
               팝업은 축제만 말하고, 가는 길은 카카오맵에 넘긴다. → ADR-041
          -->
          <a
            :href="kakaoDirectionsUrl(festival.name, festival.lat, festival.lng)"
            target="_blank"
            rel="noopener"
            class="mt-4 inline-block text-sm font-medium underline"
          >
            {{ t.spot.directions }}
          </a>
        </section>

        <p class="px-6 pb-6 text-[13px] text-muted-soft">{{ t.festival.source }}</p>
      </div>
    </dialog>
  </template>
</template>
