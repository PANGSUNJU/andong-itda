// #shared 별칭이 아니라 상대경로를 쓴다. 별칭은 Nuxt만 알기 때문에
// scripts/check-spot-match.ts를 node로 직접 돌릴 때 해석되지 않는다.
// import type은 어차피 컴파일에서 지워지므로 별칭을 그대로 둔다.
import { CONTENT_TYPE, KOR_SERVICE_REGION, LOCGO_HUB_REGION } from '../../shared/constants/region.ts'
import type { HubSpot, KorSpot, Spot, TourApiResponse } from '#shared/types/tour'

/**
 * 한국관광공사 TourAPI 호출과 두 데이터셋의 병합
 *
 * 반드시 서버에서만 호출한다.
 *   1. 인증키가 클라이언트 번들에 노출되면 안 된다
 *   2. LocgoHub는 http라서 https 페이지에서 직접 부르면 Mixed Content로 차단된다
 *   3. CORS를 허용하지 않는다
 */
const LOCGO_HUB = 'http://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1'
const KOR_SERVICE = 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2'

/**
 * 인증키 정규화
 *
 * ⚠️ 실호출로 확인한 함정 (2026-07-30)
 *    .env에 담긴 키는 data.go.kr의 **Encoding** 키다(96자, % 이스케이프 포함).
 *    이걸 그대로 query에 넘기면 ofetch가 한 번 더 인코딩해 401 Unauthorized가 된다.
 *    검증: 원문 그대로 → 200 / encodeURIComponent 적용 → 401 / 디코딩 후 재인코딩 → 200
 *
 *    그래서 한 번 디코딩해 원문으로 만들어 두고, 인코딩은 직렬화 단계에 딱 한 번 맡긴다.
 *    Decoding 키를 붙여넣어도 그대로 동작한다(% 없으면 디코딩이 무연산).
 *    PROJECT-PROMPT는 Decoding 키를 쓰라고 적혀 있으나 실제 .env는 Encoding 키였다.
 */
function serviceKey(): string {
  const key = useRuntimeConfig().tourApiKey

  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'TOUR_API_KEY가 설정되지 않았다',
      data: { hint: '.env에 TOUR_API_KEY를 넣고 서버를 재시작한다' },
    })
  }

  try {
    return decodeURIComponent(key)
  } catch {
    // %를 포함하지만 유효한 이스케이프가 아닌 키. 원문을 그대로 쓴다.
    return key
  }
}

/**
 * TourAPI 공통 호출
 *
 * 두 서비스가 같은 래퍼(response.header/body)를 쓴다.
 * 결과가 없으면 items가 빈 배열이 아니라 빈 문자열('')로 온다. 그 처리를 여기서 끝낸다.
 */
async function fetchTourApi<T>(
  url: string,
  params: Record<string, string | number>,
): Promise<{ items: T[]; totalCount: number }> {
  let body: TourApiResponse<T>['response']

  try {
    const res = await $fetch<TourApiResponse<T>>(url, {
      query: {
        serviceKey: serviceKey(),
        MobileOS: 'ETC',
        MobileApp: 'AndongItda',
        _type: 'json',
        ...params,
      },
      timeout: 10_000,
    })
    body = res.response
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'TourAPI 호출 실패',
      data: {
        upstream: url,
        reason: error instanceof Error ? error.message : String(error),
      },
      cause: error,
    })
  }

  if (body?.header?.resultCode !== '0000') {
    /**
     * 이 API는 에러 메시지 괄호 안에 잘못된 파라미터명을 알려준다.
     * 예: INVALID_REQUEST_PARAMETER_ERROR(Keyword) — searchKeyword2는 대문자 K를 쓴다.
     * 그래서 resultMsg를 그대로 실어 보낸다.
     */
    throw createError({
      statusCode: 502,
      statusMessage: 'TourAPI가 오류를 반환했다',
      data: {
        upstream: url,
        resultCode: body?.header?.resultCode ?? null,
        resultMsg: body?.header?.resultMsg ?? null,
      },
    })
  }

  const { items, totalCount } = body.body
  return { items: items === '' ? [] : items.item, totalCount }
}

/** YYYYMM. n개월 전. */
function monthCode(monthsAgo: number): string {
  const d = new Date()
  d.setDate(1) // 말일에 setMonth하면 달이 튄다(7/31 → 6/31 = 7/1). 1일로 고정하고 뺀다.
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * LocgoHub 중심관광지 — 관광지 데이터의 뼈대
 *
 * baseYm(YYYYMM)이 필수인데 최신 월이 아직 비어 있을 수 있다.
 * 검증(2026-07-30): 202607 → totalCount 0, 202606 → 100건.
 * 매월 8일 갱신이라는 설명과 달리 7월 말에도 7월분이 없었다.
 * 빈 응답은 오류가 아니라 "아직 안 나옴"이므로 이전 월로 물러난다.
 *
 * 숙박은 제외한다. 100건 중 36건이 호텔·모텔인데,
 * 그게 관광지 순위에 섞이면 순위 자체를 못 믿게 된다. → ADR-009
 */
export async function fetchHubSpots(): Promise<{ items: HubSpot[]; baseYm: string }> {
  for (let monthsAgo = 0; monthsAgo <= 3; monthsAgo++) {
    const baseYm = monthCode(monthsAgo)
    const { items } = await fetchTourApi<HubSpot>(LOCGO_HUB, {
      numOfRows: 100,
      pageNo: 1,
      baseYm,
      ...LOCGO_HUB_REGION,
    })

    if (items.length > 0) {
      return { items: items.filter((item) => item.hubCtgryLclsNm !== '숙박'), baseYm }
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: 'LocgoHub에 최근 4개월치 데이터가 모두 없다',
    data: { tried: [0, 1, 2, 3].map(monthCode) },
  })
}

/**
 * KorService2 지역기반 목록 — 설명·이미지·주소 보강용
 *
 * 관광지(12)와 문화시설(14)을 함께 가져온다. LocgoHub 상위권에
 * 박물관·기념관이 섞여 있어 12만으로는 병합률이 떨어진다.
 * 검증(2026-07-30): 12 → 64건, 14 → 12건.
 */
export async function fetchKorSpots(): Promise<KorSpot[]> {
  const lists = await Promise.all(
    [CONTENT_TYPE.TOURIST_SPOT, CONTENT_TYPE.CULTURAL_FACILITY].map((contentTypeId) =>
      fetchTourApi<KorSpot>(KOR_SERVICE, {
        numOfRows: 100,
        pageNo: 1,
        contentTypeId,
        ...KOR_SERVICE_REGION,
      }),
    ),
  )

  return lists.flatMap((list) => list.items)
}

/** 두 좌표 사이 직선거리(m). 하버사인. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * 이름 정규화
 *
 * 두 데이터셋이 같은 장소를 다르게 적는다.
 *   "안동하회마을"  ↔ "하회마을"      LocgoHub가 시군명을 앞에 붙인다
 *   "개목사(안동)"  ↔ "개목사"        KorService2가 동명이소 구분을 괄호로 붙인다
 * 접두어 '안동'과 괄호를 떼고 공백을 지운 뒤 비교한다.
 */
export function normalizeSpotName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/\s/g, '')
    .replace(/^안동(?=.)/, '')
}

/**
 * 이름 유사도 0~1 — 좌표 매칭의 보조 판정
 *
 * 완전일치 1, 포함관계 0.9, 그 외는 2-gram Dice 계수.
 * 라이브러리를 붙이지 않았다. 한글 2-gram이면 이 정도 구분에 충분하다.
 */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeSpotName(a)
  const y = normalizeSpotName(b)

  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return 0.9

  const grams = (s: string) =>
    new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)))
  const gx = grams(x)
  const gy = grams(y)
  if (gx.size === 0 || gy.size === 0) return 0

  let shared = 0
  for (const gram of gx) if (gy.has(gram)) shared++
  return (2 * shared) / (gx.size + gy.size)
}

/** 같은 장소로 볼 최대 거리(m). → PROJECT-PROMPT §3-4 */
export const MATCH_RADIUS_M = 200

/** 좌표가 겹쳤을 때 이름이 최소한 이만큼은 닮아야 같은 장소로 본다. */
export const NAME_SIMILARITY_MIN = 0.4

/**
 * LocgoHub 한 건에 대응하는 KorService2 항목 찾기
 *
 * 공통 키가 없다. hubTatsCd는 해시고 contentid는 별개 체계다. → ADR-004
 *
 * 좌표 거리를 1순위로 쓴다. 이름 표기는 흔들리지만 좌표는 흔들리지 않기 때문이다.
 * 200m 안의 후보를 거리순으로 세우고, 이름 유사도 게이트를 통과하는 가장 가까운 것을 택한다.
 * 하회마을 안에는 탈박물관·전수관이 몰려 있어 거리만으로는 엉뚱한 항목이 붙는다.
 * 그래서 이름을 보조 게이트로 둔다.
 *
 * 매칭 실패는 정상이다. 이 데이터셋에는 하회마을·도산서원·월영교가 아예 없다.
 * 그때는 LocgoHub 단독으로 표시하고 이미지를 폴백한다. → ADR-004
 */
export function matchKorSpot(hub: HubSpot, korSpots: KorSpot[]): KorSpot | null {
  const lat = Number(hub.mapY)
  const lng = Number(hub.mapX)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const matched = korSpots
    .map((kor) => ({
      kor,
      distance: distanceMeters(lat, lng, Number(kor.mapy), Number(kor.mapx)),
    }))
    .filter(({ distance }) => distance <= MATCH_RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
    .find(({ kor }) => nameSimilarity(hub.hubTatsNm, kor.title) >= NAME_SIMILARITY_MIN)

  return matched?.kor ?? null
}

/** LocgoHub를 뼈대로, 찾아낸 KorService2 정보를 얹어 화면용 Spot을 만든다. */
export function mergeSpot(hub: HubSpot, kor: KorSpot | null): Spot {
  return {
    // 뼈대가 LocgoHub이므로 id도 hubTatsCd를 쓴다. 병합 여부와 무관하게 안정적이다.
    id: hub.hubTatsCd,
    name: hub.hubTatsNm,
    rank: Number(hub.hubRank),
    category: hub.hubCtgryMclsNm,
    lat: Number(hub.mapY),
    lng: Number(hub.mapX),
    // 병합 실패 시 필드를 넣지 않는다. 빈 문자열을 넣으면 화면이
    // "주소 없음"과 "주소가 빈 값"을 구분할 수 없다.
    ...(kor?.addr1 ? { address: kor.addr1 } : {}),
    // firstimage는 64건 중 4건이 빈 문자열이다. 폴백 UI가 판단하도록 비워 둔다.
    ...(kor?.firstimage ? { imageUrl: kor.firstimage } : {}),
    ...(kor ? { contentId: kor.contentid } : {}),
  }
}
