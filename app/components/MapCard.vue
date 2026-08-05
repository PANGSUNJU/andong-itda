<script setup lang="ts">
import { ANDONG_ORIGIN } from '#shared/constants/location'
import type { KakaoMaps } from '~/composables/useKakaoMap'

/**
 * 지도 — 카카오맵. 없으면 없다고 말한다
 *
 * ADR-013에서 지도를 **부분 배치**하되 전면 지도 UI는 쓰지 않기로 했다.
 * 이 서비스의 주장은 "몇 분 후 버스"지 지도가 아니다. 그래서 이 카드는
 * **조작하지 않는 그림**이다. 드래그와 줌을 끈다.
 *
 * 조작을 끄는 건 기능을 아끼는 게 아니라 스크롤을 지키는 것이다. 카드 안 지도가
 * 페이지 스크롤을 먹으면 모바일에서 아래 목록으로 내려갈 수가 없다.
 * 여기서 지도가 하는 일은 "어디쯤에 몇 개가 흩어져 있나"를 한눈에 주는 것뿐이고,
 * 그건 조작 없이도 된다.
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
  markers?: Array<{ lat: number; lng: number; name: string }>
  /** 중심에서 그릴 반경(m). 도보권을 눈으로 보여줄 때만 쓴다. */
  radiusM?: number
}>()

const { kakaoMapKey } = useRuntimeConfig().public

/** 단청 주홍. 디자인 토큰 --primary와 같은 값이다. SDK에는 CSS 변수를 넘길 수 없다. */
const PRIMARY = '#D9453C'

const container = ref<HTMLElement | null>(null)
const failed = ref(false)

let map: KakaoMaps = null
/** 우리가 만든 것만 들고 있는다. 다시 그릴 때 이것만 지운다. */
let overlays: KakaoMaps[] = []

function clearOverlays() {
  for (const overlay of overlays) overlay.setMap(null)
  overlays = []
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

  // 좌표가 없는 항목이 섞여 들어올 수 있다. LatLng에 NaN을 넘기면 지도가 통째로 깨진다.
  const points = (props.markers ?? []).filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  )

  for (const point of points) {
    const marker = new maps.Marker({
      position: new maps.LatLng(point.lat, point.lng),
      title: point.name,
    })
    marker.setMap(map)
    overlays.push(marker)
  }

  /**
   * 반경 원과 중심점
   *
   * 중심은 "나"라는 뜻이므로 마커가 아니라 점으로 그린다. 마커를 쓰면
   * 관광지 마커들과 같은 모양이 되어 어느 것이 나인지 알 수 없다.
   */
  let circle: KakaoMaps = null

  if (props.radiusM && props.center) {
    const origin = new maps.LatLng(props.center.lat, props.center.lng)

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

    const dot = new maps.CustomOverlay({
      position: origin,
      zIndex: 3,
      content: `<span style="display:block;width:12px;height:12px;border-radius:9999px;background:${PRIMARY};box-shadow:0 0 0 3px rgba(217,69,60,.25)"></span>`,
    })
    dot.setMap(map)
    overlays.push(dot)
  }

  // 화면 맞추기. 원이 있으면 원 전체가, 없으면 마커 전부가 들어오게 한다.
  if (circle) {
    map.setBounds(circle.getBounds())
  } else if (points.length > 1) {
    const bounds = new maps.LatLngBounds()
    for (const point of points) bounds.extend(new maps.LatLng(point.lat, point.lng))
    map.setBounds(bounds, 24, 24, 24, 24)
  } else {
    const only = points[0] ?? props.center ?? ANDONG_ORIGIN
    map.setCenter(new maps.LatLng(only.lat, only.lng))
    // 한 곳만 있으면 그 주변이 보이게, 아무것도 없으면 안동 전체가 보이게.
    map.setLevel(points.length === 1 ? 5 : 8)
  }
}

onMounted(async () => {
  if (!kakaoMapKey || !container.value) return

  try {
    const maps = await loadKakaoMaps(String(kakaoMapKey))

    map = new maps.Map(container.value, {
      center: new maps.LatLng(ANDONG_ORIGIN.lat, ANDONG_ORIGIN.lng),
      level: 6,
      draggable: false,
    })
    map.setZoomable(false)

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
})
</script>

<template>
  <div class="overflow-hidden rounded-md border border-hairline">
    <div class="bg-surface-soft" :style="{ height: height ?? '220px' }">
      <div v-if="kakaoMapKey && !failed" ref="container" class="h-full w-full" />

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
            {{ failed ? '지도를 불러오지 못했어요' : '지도 준비 중' }}
          </p>
        </div>
      </div>
    </div>

    <p class="border-t border-hairline-soft px-4 py-3 text-[13px] text-muted">{{ caption }}</p>
  </div>
</template>
