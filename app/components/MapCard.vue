<script setup lang="ts">
import { ANDONG_ORIGIN } from '#shared/constants/location'
import type { KakaoMaps } from '~/composables/useKakaoMap'

/**
 * 지도 — 카카오맵. 없으면 없다고 말한다
 *
 * ADR-013에서 지도를 **부분 배치**하되 전면 지도 UI는 쓰지 않기로 했다.
 * 카드 크기는 그대로 두고 조작만 연다. 이동·확대·축소가 되어야
 * "이게 걸어갈 거리인가"를 카드 안에서 확인할 수 있다.
 *
 * 다만 **휠 줌은 끈다**(`scrollwheel: false`). 카드 위에서 스크롤이 확대로 바뀌면
 * 페이지가 그 자리에 붙잡힌다. 확대·축소는 컨트롤 버튼·더블클릭·핀치로 한다.
 *
 * 상태가 셋이다. 화면에서 구분되어야 한다.
 *   키 없음    → "지도 준비 중". 아직 안 붙인 것이지 고장이 아니다
 *   로드 실패  → "지도를 불러오지 못했어요". 도메인 미등록이 가장 흔하다
 *   정상       → 지도
 */
const props = defineProps<{
  /** 지도가 무엇을 보여주는지. 지도가 없을 때도 이 문장은 남는다. */
  caption: string
  height?: string
  /** 지도 중심. 반경 원을 그릴 때는 그 원의 중심이기도 하다. */
  center?: { lat: number; lng: number }
  /**
   * 찍을 지점들.
   *
   * `kind: 'stop'`은 정류장이다. 관광지와 같은 핀으로 그리면 "여기가 볼거리"로 읽힌다.
   * 홈에서는 이름이 같은 승강장 셋을 눈으로 갈라야 해서, 고른 하나(`active`)만
   * 채운 점과 이름표로 도드라지게 한다.
   */
  markers?: Array<{
    lat: number
    lng: number
    name: string
    /** 이름만으로 부족할 때 덧붙이는 한 줄. 정류장의 "○○ 방면"이 여기다. */
    note?: string
    kind?: 'spot' | 'stop'
    active?: boolean
  }>
  /**
   * 중심에서 그릴 반경(m).
   *
   * ⚠️ 원은 **화면보다 넓을 때만 뜻이 있다.** 지도가 원 안에 통째로 들어가면
   *    호가 하나도 안 보여서 화면 전체에 분홍색이 깔린 것으로만 보인다.
   *    반경보다 좁게 확대하는 화면에서는 넘기지 말 것. → 홈의 "걸어서"가 그 경우다.
   */
  radiusM?: number
  /**
   * 중심에 "나" 점을 찍을지.
   *
   * 원과 떼어 놨다. 원은 반경을 말하고 이 점은 위치를 말하는데, 둘을 한 조건에
   * 묶어 두면 원을 끄는 순간 내가 어디 서 있는지도 함께 사라진다.
   */
  markCenter?: boolean
  /**
   * 이름을 지도에 인쇄할지. 기본은 인쇄한다.
   *
   * 끄는 자리가 있다. 핀이 한곳에 뭉치면 이름표끼리 겹쳐 서로를 덮는데,
   * 그렇게 겹친 글자는 안 읽히는 데서 그치지 않고 옆 핀의 글자와 섞여 **틀린 문장**이
   * 된다("…약 15분 by bus by bus"). 그때는 인쇄를 접고 눌러서 보게 한다.
   */
  printNames?: boolean
}>()

const { kakaoMapKey } = useRuntimeConfig().public

const t = useT()

/**
 * ⚠️ 지도 위의 이름표는 **국문 그대로**다. 카카오맵 자체가 국문 지도라
 *    핀 옆에만 영문을 인쇄하면 지도 배경의 지명과 어긋나 오히려 못 찾는다.
 *    문구(캡션·버튼·안내)만 언어를 따른다.
 */

/** 단청 주홍. 디자인 토큰 --primary와 같은 값이다. SDK에는 CSS 변수를 넘길 수 없다. */
const PRIMARY = '#D9453C'
/** --color-ink · --color-muted-soft와 같은 값. 위와 같은 이유로 값을 적는다. */
const INK = '#1F1B17'
const MUTED_SOFT = '#948C83'

const container = ref<HTMLElement | null>(null)
const failed = ref(false)

let map: KakaoMaps = null
/** SDK 네임스페이스. 되돌리기 버튼이 마운트 이후에도 화면을 다시 맞추려면 필요하다. */
let sdk: KakaoMaps = null
/** 반경 원. 있으면 화면 맞추기의 기준이 된다. */
let circle: KakaoMaps = null
/** 우리가 만든 것만 들고 있는다. 다시 그릴 때 이것만 지운다. */
let overlays: KakaoMaps[] = []

/** 눌러서 뜬 이름표. 한 번에 하나만 띄운다. */
let label: KakaoMaps = null

function clearOverlays() {
  for (const overlay of overlays) overlay.setMap(null)
  overlays = []
  circle = null
  hideLabel()
}

function hideLabel() {
  label?.setMap(null)
  label = null
}

/**
 * 마커를 누르면 이름을 띄운다
 *
 * 기본 마커의 `title`은 데스크톱 호버 툴팁이라 폰에서는 아무 일도 일어나지 않는다.
 * 지도에 점만 찍히고 그게 뭔지 알 방법이 없으면 지도가 아니라 무늬다.
 *
 * ⚠️ 이름은 상류(관광공사·안동시)가 준 문자열이다. innerHTML로 넣지 않고
 *    textContent로 붙인다. 지도 하나 때문에 남의 데이터를 실행시킬 이유가 없다.
 */
function showLabel(position: KakaoMaps, text: string, above: number) {
  if (!map || !sdk) return
  hideLabel()

  const bubble = document.createElement('span')
  bubble.textContent = text
  bubble.style.cssText = `display:block;white-space:nowrap;background:${INK};color:#fff;border-radius:9999px;padding:5px 10px;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25)`

  label = new sdk.CustomOverlay({
    position,
    content: bubble,
    // yAnchor는 이름표 높이의 배수다. 마커(42px)와 점(22px)의 키가 달라 값이 다르다.
    yAnchor: above,
    zIndex: 9,
  })
  label.setMap(map)
}

/**
 * 이름을 지도에 인쇄해 두는 한계 개수
 *
 * 카카오맵처럼 마커 옆에 이름이 늘 보여야 그게 어디인지 알 수 있다. 다만 둘러보기는
 * 마커가 49개까지 가므로 전부 인쇄하면 글자가 서로를 덮어 아무것도 안 읽힌다.
 * 상용 지도는 겹침을 계산해 솎아내지만 그건 이 카드가 할 일이 아니다.
 * 여기서는 개수로 끊고, 많을 때는 눌러서 보게 한다.
 */
const LABEL_LIMIT = 9

/** 눌렀을 때 뜨는 문구. 이름이 같은 승강장 셋은 방면까지 있어야 구분된다. */
const describe = (point: { name: string; note?: string }) =>
  point.note ? `${point.name} · ${point.note}` : point.name

/** 좌표가 없는 항목이 섞여 들어올 수 있다. LatLng에 NaN을 넘기면 지도가 통째로 깨진다. */
const validMarkers = computed(() =>
  (props.markers ?? []).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
)

/**
 * 화면이 이보다 좁아지지는 않게 하는 폭(m)
 *
 * 정류장 다섯 곳이 300m 안에 모여 있으면 그 300m에 딱 맞춰 확대된다. 건물 단위라
 * 어느 동네인지가 화면에서 사라진다. 최소 폭을 둬서 동 이름과 큰길이 함께 남게 한다.
 */
const MIN_SPAN_M = 600

/** 위도 1도의 길이(m). 경도는 위도에 따라 줄어들므로 cos를 곱해 쓴다. */
const METERS_PER_DEGREE = 111_320

/** 최소 폭보다 좁은 범위를 그 폭까지 넓힌다. 이미 넓으면 아무 일도 하지 않는다. */
function ensureMinSpan(bounds: KakaoMaps) {
  if (!sdk) return

  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const lat = (sw.getLat() + ne.getLat()) / 2
  const lng = (sw.getLng() + ne.getLng()) / 2

  const halfLat = MIN_SPAN_M / 2 / METERS_PER_DEGREE
  const halfLng = halfLat / Math.cos((lat * Math.PI) / 180)

  bounds.extend(new sdk.LatLng(lat - halfLat, lng - halfLng))
  bounds.extend(new sdk.LatLng(lat + halfLat, lng + halfLng))
}

/**
 * 화면 맞추기 — 원이 아니라 **찍힌 것**에 맞춘다
 *
 * `draw()`에서 떼어냈다. 지도를 움직일 수 있게 된 이상 되돌아올 방법이 있어야 하고,
 * 되돌아온다는 건 처음 그 화면으로 다시 맞춘다는 뜻이다.
 *
 * ⚠️ 원을 화면 맞추기의 기준으로 삼지 않는다. 반경 2km 원은 지름 4km이고 이 카드는
 *    높이가 220px이라, 원을 다 담으려면 1px이 40m가 된다. 그 축척에서 83m 떨어진
 *    승강장 둘은 2px 차이라 붙어 버린다 — 이 지도가 하려던 일이 그 축척에서 죽는다.
 *    원은 배경으로 남기고, 화면은 실제로 찍힌 지점들에 맞춘다.
 *
 * 원이 있으면(홈의 "버스로") 그때는 원까지 함께 담는다. 그 화면은 원보다 넓어서
 * 원이 작게 찍히고, 그 작음이 "걸어서는 여기까지"라는 뜻이 된다.
 */
function fit() {
  if (!map || !sdk) return

  const points = validMarkers.value

  if (points.length > 1 || circle || props.center) {
    const bounds = new sdk.LatLngBounds()
    for (const point of points) bounds.extend(new sdk.LatLng(point.lat, point.lng))

    if (circle) {
      const circleBounds = circle.getBounds()
      bounds.extend(circleBounds.getSouthWest())
      bounds.extend(circleBounds.getNorthEast())
    } else if (props.center) {
      // 원이 없어도 "나"는 화면에 있어야 한다. 내가 안 보이는 지도는 방향을 못 준다.
      bounds.extend(new sdk.LatLng(props.center.lat, props.center.lng))
    }

    ensureMinSpan(bounds)
    map.setBounds(bounds, 24, 24, 24, 24)
    return
  }

  // 기준이 점 하나뿐이거나 아무것도 없을 때. 맞출 범위가 없으니 축척을 직접 준다.
  const only = points[0] ?? props.center ?? ANDONG_ORIGIN
  map.setCenter(new sdk.LatLng(only.lat, only.lng))
  // 한 곳만 있으면 그 주변이 보이게, 아무것도 없으면 안동 전체가 보이게.
  map.setLevel(points.length === 1 ? 5 : 8)
}

/**
 * 지도에 인쇄되는 이름 — 상용 지도의 지명 라벨과 같은 모양
 *
 * 말풍선을 쓰지 않는다. 마커마다 흰 상자가 뜨면 지도가 상자로 덮인다.
 * 흰 테두리를 두른 글자는 배경이 어떤 색이어도 읽히면서 지도를 가리지 않는다.
 */
function nameLabel(maps: KakaoMaps, position: KakaoMaps, text: string, below: number) {
  const el = document.createElement('span')
  el.textContent = text
  el.style.cssText = `display:block;padding-top:${below}px;white-space:nowrap;font-size:11px;font-weight:600;color:${INK};text-shadow:-1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff,0 0 3px #fff`

  // yAnchor 0 — 상자 윗변이 좌표에 붙는다. 마커는 좌표 위쪽에 서므로 글자는 그 아래로 간다.
  const overlay = new maps.CustomOverlay({ position, content: el, yAnchor: 0, zIndex: 2 })
  overlay.setMap(map)
  overlays.push(overlay)
}

/** "처음 화면으로" — 열어 둔 이름표까지 함께 걷는다. */
function reset() {
  hideLabel()
  fit()
}

/**
 * 지점과 반경을 다시 그린다
 *
 * 좌표가 바뀌는 자리가 실제로 있다. 홈은 위치 권한이 잡히면 중심이 옮겨가고,
 * 둘러보기는 탭·칩·검색어에 따라 마커 집합이 통째로 바뀐다.
 */
function draw(maps: KakaoMaps) {
  if (!map) return
  clearOverlays()

  const points = validMarkers.value
  const printNames = (props.printNames ?? true) && points.length <= LABEL_LIMIT

  for (const point of points) {
    const position = new maps.LatLng(point.lat, point.lng)

    /**
     * 정류장은 핀이 아니라 점이다.
     *
     * 기본 핀으로 그리면 관광지 마커와 같은 모양이 되어, 홈에서 "볼거리 여섯 곳" 옆에
     * "정류장 셋"이 구분 없이 섞인다. 고른 승강장만 채워 도드라지게 하고
     * 나머지는 테두리만 남긴다 — 이름이 같은 셋을 지도에서 가르는 유일한 표시다.
     */
    if (point.kind === 'stop') {
      /**
       * ⚠️ CustomOverlay는 content를 좌표에 **가운데 정렬**해서 붙인다(기본 앵커 0.5).
       *    직접 transform으로 당기면 두 번 밀린다. 아래 "나" 점에 transform이 없는 것도
       *    같은 이유다. 이름표는 absolute로 띄운다 — 그래야 상자 크기가 점 그대로라
       *    중심이 이름표 길이만큼 밀리지 않는다.
       */
      const dot = document.createElement('span')
      dot.style.cursor = 'pointer'

      if (point.active) {
        dot.style.cssText += `position:relative;display:block;width:22px;height:22px;border-radius:9999px;background:${INK};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`

        const ribbon = document.createElement('span')
        // ?? 가 아니라 || 다. 방면을 모르는 정류장은 note가 빈 문자열로 온다.
        ribbon.textContent = point.note || point.name
        ribbon.style.cssText = `position:absolute;left:28px;top:50%;transform:translateY(-50%);white-space:nowrap;background:${INK};color:#fff;border-radius:9999px;padding:3px 8px;font-size:11px;font-weight:600`
        dot.append(ribbon)
      } else {
        dot.style.cssText += `display:block;width:14px;height:14px;border-radius:9999px;background:#fff;border:2px solid ${MUTED_SOFT};box-shadow:0 1px 3px rgba(0,0,0,.2)`
      }

      // CustomOverlay에는 지도 이벤트가 안 붙는다. DOM에 직접 건다.
      dot.addEventListener('click', () => showLabel(position, describe(point), 1.9))

      const overlay = new maps.CustomOverlay({
        position,
        content: dot,
        zIndex: point.active ? 5 : 4,
      })
      overlay.setMap(map)
      overlays.push(overlay)

      // 고른 승강장은 리본이 이미 이름을 달고 있다. 두 번 쓰지 않는다.
      if (printNames && !point.active) nameLabel(maps, position, point.name, 12)
      continue
    }

    const marker = new maps.Marker({ position, title: point.name })
    marker.setMap(map)
    overlays.push(marker)
    // 마커는 키가 42px이라 이름표를 점보다 더 위로 띄운다.
    maps.event.addListener(marker, 'click', () => showLabel(position, describe(point), 3))

    /**
     * 관광지 이름표에도 한 줄을 덧붙일 수 있게 둔다. 홈의 "버스로 갈 곳"이
     * "도산서원 · 버스로 약 45분"으로 뜨는 자리다. note가 없으면 이름만 나온다.
     */
    if (printNames) nameLabel(maps, position, describe(point), 2)
  }

  /**
   * "나"와, 요청이 있으면 반경 원
   *
   * 중심은 "나"라는 뜻이므로 마커가 아니라 점으로 그린다. 마커를 쓰면
   * 관광지 마커들과 같은 모양이 되어 어느 것이 나인지 알 수 없다.
   *
   * 원은 `radiusM`을 받은 화면에만 그린다. 반경보다 좁게 확대하는 화면에서는
   * 호가 화면 밖으로 나가 분홍색 배경만 남는다. → `radiusM` 프롭의 경고
   */
  if (props.center && (props.radiusM || props.markCenter)) {
    const origin = new maps.LatLng(props.center.lat, props.center.lng)

    if (props.radiusM) {
      circle = new maps.Circle({
        center: origin,
        radius: props.radiusM,
        strokeWeight: 2,
        strokeColor: PRIMARY,
        strokeOpacity: 0.5,
        fillColor: PRIMARY,
        fillOpacity: 0.06,
      })
      circle.setMap(map)
      overlays.push(circle)
    }

    const dot = new maps.CustomOverlay({
      position: origin,
      zIndex: 3,
      content: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${PRIMARY};box-shadow:0 0 0 3px rgba(217,69,60,.25)"></span>`,
    })
    dot.setMap(map)
    overlays.push(dot)
  }

  // 데이터가 바뀌었으면 그 데이터가 다 보이는 화면으로 맞춘다.
  fit()
}

onMounted(async () => {
  if (!kakaoMapKey || !container.value) return

  try {
    const maps = await loadKakaoMaps(String(kakaoMapKey))
    sdk = maps

    map = new maps.Map(container.value, {
      center: new maps.LatLng(ANDONG_ORIGIN.lat, ANDONG_ORIGIN.lng),
      level: 6,
      // 휠은 페이지 스크롤에 남긴다. 지도 위라고 스크롤이 확대로 바뀌면 안 된다.
      scrollwheel: false,
    })

    // 휠을 껐으니 버튼이 필요하다. 없으면 데스크톱의 줌 수단이 더블클릭뿐이다.
    map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT)

    // 빈 곳을 누르면 이름표를 닫는다. 닫는 방법이 없으면 이름표가 지도를 덮는다.
    maps.event.addListener(map, 'click', hideLabel)

    draw(maps)

    // 마운트 이후에 좌표가 바뀌는 화면이 있다. 위치 권한 응답과 목록 필터가 그렇다.
    watch(() => [props.center, props.markers, props.radiusM], () => draw(maps), { deep: true })
  } catch {
    // 원인은 콘솔에 남는다. 화면에는 "안 된다"만 말한다.
    failed.value = true
  }
})

onUnmounted(() => {
  clearOverlays()
  map = null
  sdk = null
})
</script>

<template>
  <div class="overflow-hidden rounded-md border border-hairline">
    <div class="relative bg-surface-soft" :style="{ height: height ?? '220px' }">
      <div v-if="kakaoMapKey && !failed" ref="container" class="h-full w-full" />

      <!--
        되돌리기. 움직일 수 있는 지도에는 반드시 있어야 하는 짝이다.
        길을 잃은 사람에게 새로고침 말고 다른 길을 준다.
        z-2 — 카카오 컨트롤이 z-index 1~2를 쓴다. 그 위에 얹는다.
      -->
      <button
        v-if="kakaoMapKey && !failed"
        type="button"
        class="absolute bottom-3 left-3 z-[3] rounded-full border border-hairline bg-white/95 px-3 py-1.5 text-xs font-medium shadow-float"
        @click="reset()"
      >
        {{ t.map.reset }}
      </button>

      <div v-else class="flex h-full w-full items-center justify-center px-6 text-center">
        <div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            class="mx-auto h-7 w-7 text-muted-soft"
            aria-hidden="true"
          >
            <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13" />
          </svg>
          <p class="mt-2 text-sm text-muted">
            {{ failed ? t.map.failed : t.map.pending }}
          </p>
        </div>
      </div>
    </div>

    <!--
      캡션 줄에 조작 하나를 들일 수 있게 열어 둔다. 지도 위에 얹으면 지도를 가리고
      카드 밖에 두면 무엇을 바꾸는 버튼인지 멀어진다. 홈의 "걸어서 / 버스로"가 여기 온다.
    -->
    <div class="flex items-center gap-3 border-t border-hairline-soft px-4 py-3">
      <p class="min-w-0 flex-1 text-[13px] text-muted">{{ caption }}</p>
      <slot name="action" />
    </div>
  </div>
</template>
