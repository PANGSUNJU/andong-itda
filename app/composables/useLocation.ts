import { ANDONG_ORIGIN, isInAndong } from '#shared/constants/location'

interface LocationState {
  lat: number
  lng: number
  label: string
  /** 실제 GPS 좌표인지, 대체 원점인지 */
  isFallback: boolean
  /** 폴백일 때 그 이유. 화면에서 그대로 보여준다. */
  reason: string | null
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
    label: ANDONG_ORIGIN.name,
    isFallback: true,
    reason: null,
  }))

  const locating = useState('location-pending', () => false)

  function locate() {
    if (!import.meta.client || !navigator.geolocation) {
      state.value.reason = '이 브라우저는 위치를 알려주지 못해요'
      return
    }

    locating.value = true

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        locating.value = false

        if (!isInAndong(coords.latitude, coords.longitude)) {
          state.value.reason = '안동 밖에 계신 것 같아 안동역을 기준으로 보여드려요'
          return
        }

        state.value = {
          lat: coords.latitude,
          lng: coords.longitude,
          label: '현재 위치',
          isFallback: false,
          reason: null,
        }
      },
      () => {
        locating.value = false
        // 거부·실패를 구분하지 않는다. 사용자가 할 일은 어느 쪽이든 같다.
        state.value.reason = '위치를 확인할 수 없어 안동역을 기준으로 보여드려요'
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }

  return { location: state, locating, locate }
}
