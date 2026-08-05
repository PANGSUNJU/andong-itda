/**
 * 카카오맵 SDK 로더 — 한 번만 붙이고 모두가 나눠 쓴다
 *
 * `MapCard`는 한 화면에 여러 개 뜰 수 있다(홈 1개, 둘러보기 1개, 상세 1개).
 * 컴포넌트마다 script 태그를 붙이면 SDK가 중복 로드된다.
 * 프로미스를 모듈 스코프에 캐시해 첫 호출만 실제로 받고 나머지는 같은 것을 기다린다.
 *
 * ⚠️ 가장 흔한 실패는 **도메인 미등록**이다.
 *    카카오는 콘솔 > 플랫폼 > Web에 등록되지 않은 출처에서 스크립트를 거부한다.
 *    개발(`http://localhost:3000`)과 배포 도메인을 각각 등록해야 하고,
 *    핸드폰에서 IP로 접속해 테스트한다면 그 주소(`http://192.168.x.x:3000`)도 등록해야 한다.
 *    실패는 조용하다. 그래서 여기서 reject로 바꿔 화면이 말하게 한다.
 */

/**
 * SDK 타입
 *
 * 공식 타입 패키지를 붙이지 않는다. 지도 하나 그리자고 의존성을 늘릴 이유가 없고,
 * 우리가 쓰는 API는 Map·Marker·Circle·LatLng·CustomOverlay 다섯 개뿐이다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KakaoMaps = any

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps }
  }
}

let pending: Promise<KakaoMaps> | null = null

export function loadKakaoMaps(appKey: string): Promise<KakaoMaps> {
  // 이미 초기화까지 끝난 경우. 페이지 이동으로 컴포넌트가 다시 마운트될 때 여기로 온다.
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps)
  if (pending) return pending

  pending = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement('script')

    // autoload=false — 로드와 초기화를 분리해야 load 콜백을 걸 수 있다.
    // 이걸 빼면 스크립트가 즉시 초기화되고 우리는 그 완료 시점을 알 수 없다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true

    script.onload = () => {
      const maps = window.kakao?.maps
      if (!maps) {
        reject(new Error('스크립트는 받았지만 kakao.maps가 없다'))
        return
      }
      maps.load(() => resolve(maps))
    }

    script.onerror = () => {
      // 다음 마운트에서 다시 시도할 수 있게 캐시를 비운다.
      // 실패 원인이 일시적 네트워크일 수도 있어 영구 실패로 굳히지 않는다.
      pending = null
      reject(new Error('카카오맵 SDK를 불러오지 못했다 — 콘솔의 플랫폼 도메인 등록을 확인할 것'))
    }

    document.head.appendChild(script)
  })

  return pending
}
