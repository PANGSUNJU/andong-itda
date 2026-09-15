import { ANDONG_ORIGIN, isInAndong } from '#shared/constants/location'

/**
 * ⚠️ 문구가 아니라 **키**를 담는다. 화면이 `t.location[...]`으로 옮긴다.
 *
 *    완성된 문장을 담아 두면 언어를 바꿔 같은 화면을 열었을 때 이 상태만
 *    이전 언어로 남는다. `useState`는 라우트 이동으로 초기화되지 않기 때문이다.
 *    위치를 다시 잡기 전까지 영문 화면에 국문 안내가 붙어 있게 된다. → ADR-031
 */
type LocationLabel = 'origin' | 'current'
type LocationReason = 'unsupported' | 'outside' | 'denied'

interface LocationState {
  lat: number
  lng: number
  label: LocationLabel
  /** 실제 GPS 좌표인지, 대체 원점인지 */
  isFallback: boolean
  /** 폴백일 때 그 이유. 화면이 문구로 옮긴다. */
  reason: LocationReason | null
}

/**
 * 현재 위치 — 안동역 폴백을 기본값으로 둔다
 *
 * 기본값이 폴백인 이유는 SSR 때문이다. 서버에는 위치가 없으므로 첫 렌더는
 * 반드시 안동역 기준이 된다. 그 뒤 브라우저에서 좌표가 잡히면 갱신된다.
 * 빈 화면을 보여주고 권한 응답을 기다리지 않는다. → ADR-012
 *
 * 안동 밖 좌표도 폴백으로 되돌린다. 서울에서 접속한 사람에게
 * "가장 가까운 정류장 78km"는 정보가 아니다.
 */
export function useLocation() {
  const state = useState<LocationState>('location', () => ({
    lat: ANDONG_ORIGIN.lat,
    lng: ANDONG_ORIGIN.lng,
    label: 'origin',
    isFallback: true,
    reason: null,
  }))

  const locating = useState('location-pending', () => false)

  function locate() {
    if (!import.meta.client || !navigator.geolocation) {
      state.value.reason = 'unsupported'
      return
    }

    locating.value = true

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        locating.value = false

        if (!isInAndong(coords.latitude, coords.longitude)) {
          state.value.reason = 'outside'
          return
        }

        state.value = {
          lat: coords.latitude,
          lng: coords.longitude,
          label: 'current',
          isFallback: false,
          reason: null,
        }
      },
      () => {
        locating.value = false
        // 거부·실패를 구분하지 않는다. 사용자가 할 일은 어느 쪽이든 같다.
        state.value.reason = 'denied'
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }

  /**
   * 지도에 찍어도 되는 좌표. 안동 안에서 실제로 잡혔을 때만 값이 있다.
   *
   * `label === 'current'`가 곧 "안동 안"이다 — `isInAndong()`을 통과해야만 그 값이
   * 되기 때문이다(위 `locate`). 그래서 여기서 경계를 다시 판정하지 않는다.
   *
   * `reason`까지 보는 건 화면을 연 채 안동을 벗어난 경우 때문이다. 그때 label은
   * 'current'로 남고 좌표는 낡은 값이라, 그 자리에 점을 찍으면 없는 곳에 내가 찍힌다.
   */
  const me = computed(() =>
    state.value.label === 'current' && state.value.reason !== 'outside'
      ? { lat: state.value.lat, lng: state.value.lng }
      : null,
  )

  return { location: state, locating, locate, me }
}
