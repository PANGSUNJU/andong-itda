// #shared 별칭이 아니라 상대경로를 쓴다. 별칭은 Nuxt만 알기 때문에
// scripts/check-spot-match.ts를 node로 직접 돌릴 때 해석되지 않는다.
// import type은 어차피 컴파일에서 지워지므로 별칭을 그대로 둔다.
import { festivalQueryStartDate, kstToday } from '../../shared/constants/festival.ts'
import { distanceMeters } from '../../shared/constants/location.ts'
import {
  CONTENT_TYPE,
  FOOD_CAT3,
  FOOD_LCLS,
  KOR_SERVICE_LDONG_REGION,
  LOCGO_HUB_REGION,
} from '../../shared/constants/region.ts'
import type {
  EngFestival,
  EngSpot,
  FoodCategory,
  FoodPlace,
  GalleryPhoto,
  HubSpot,
  KorFestival,
  KorFestivalWithEnglish,
  KorSpot,
  RelatedSpot,
  RelatedSpotItem,
  Spot,
  SpotGuide,
  TourApiResponse,
} from '#shared/types/tour'

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
const KOR_SEARCH = 'https://apis.data.go.kr/B551011/KorService2/searchKeyword2'
const PHOTO_GALLERY = 'https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1'
const REL_SERVICE = 'https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1'
const ENG_SERVICE = 'https://apis.data.go.kr/B551011/EngService2/areaBasedList2'
const KOR_FESTIVAL = 'https://apis.data.go.kr/B551011/KorService2/searchFestival2'
const ENG_FESTIVAL = 'https://apis.data.go.kr/B551011/EngService2/searchFestival2'
const KOR_DETAIL_COMMON = 'https://apis.data.go.kr/B551011/KorService2/detailCommon2'
const KOR_DETAIL_INTRO = 'https://apis.data.go.kr/B551011/KorService2/detailIntro2'
const ENG_DETAIL_INTRO = 'https://apis.data.go.kr/B551011/EngService2/detailIntro2'
const ENG_DETAIL_COMMON = 'https://apis.data.go.kr/B551011/EngService2/detailCommon2'

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
/**
 * 인증키를 지운다 — **로그에도 응답에도 키가 남으면 안 된다**
 *
 * ⚠️ ofetch의 오류 메시지는 요청 URL을 **쿼리스트링째** 담는다. 그 안에
 *    `serviceKey`가 들어 있다. 실제로 배포 로그에 키가 통째로 찍혀 있었다
 *    (2026-09-11 발견). 더 나쁜 것은 그 메시지가 아래 `createError`의
 *    `data.reason`으로 들어가 **502 응답 본문에 실려 브라우저까지 나간다**는 점이다.
 *    TourAPI가 한 번 흔들리면 그때 화면을 열고 있던 누구에게나 키가 간다.
 *
 * 진단에 필요한 것은 "어느 주소가 무슨 코드로 실패했는가"이지 키가 아니다.
 */
function redactKey(text: string): string {
  return text.replace(/serviceKey=[^&"s]*/gi, 'serviceKey=***')
}

/**
 * 오류에서 사람이 읽을 한 줄을 꺼낸다.
 *
 * `fetchTourApi`는 `createError`로 감싸 던지고 진짜 원인은 `data.reason`에 있다.
 * 그걸 안 꺼내면 로그에 "TourAPI 호출 실패"만 남아 아무것도 말해 주지 않는다.
 */
function reasonOf(error: unknown): string {
  const data = (error as { data?: { reason?: string } })?.data
  if (data?.reason) return redactKey(data.reason)
  return redactKey(error instanceof Error ? error.message : String(error))
}

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
        // 키를 지우고 담는다. 이 data는 502 본문으로 브라우저까지 나간다.
        reason: redactKey(error instanceof Error ? error.message : String(error)),
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

/**
 * 이미지 URL을 https로 올린다
 *
 * ⚠️ 상류가 http와 https를 섞어 준다. 실측(2026-08-16): 관광지 사진 41장 중 **23장이 http**,
 *    갤러리는 1000건 중 883건이 http다. 배포는 https이므로 그대로 두면 그 절반이
 *    Mixed Content로 **차단된다.** 개발(http://localhost)에서는 멀쩡히 보여서 안 드러난다.
 *
 * 같은 경로를 https로 요청하면 동일한 이미지가 200으로 열리는 것을 확인했다
 * (`tong.visitkorea.or.kr` 한 호스트뿐이다).
 *
 * 이미지가 들어오는 자리가 넷(지역 병합·키워드 보충·갤러리·음식점)이므로
 * 대입하는 쪽마다 고치지 않고 여기 한 곳을 지나가게 한다.
 */
export function httpsImage(url: string): string {
  return url.replace(/^http:\/\//, 'https://')
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
 * 두 번 거른다.
 *   숙박   100건 중 36건이 호텔·모텔이다. 관광지 순위에 섞이면 순위를 못 믿게 된다. → ADR-009
 *   노이즈 골프장·영화관·역·체육시설·도매시장. 방문 데이터의 부산물이다. → ADR-022
 *
 * 거르는 건 "없는 척"이 아니라 "이 서비스의 목록이 아니다"라는 뜻이다.
 * 빈 응답과 구분되도록 무엇이 왜 빠졌는지는 noiseReason이 이름으로 남긴다.
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
      return {
        items: items.filter(
          (item) => item.hubCtgryLclsNm !== '숙박' && !noiseReason(item.hubTatsNm),
        ),
        baseYm,
      }
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
 * 실측(2026-08-23): 12 → 107건, 14 → 26건. 호출 2회에 178ms.
 *
 * ⚠️ 법정동 코드로 조회한다. 옛 지역 코드로는 74건이고 하회마을·도산서원·월영교가
 *    통째로 빠진다. → KOR_SERVICE_LDONG_REGION
 *
 * ⚠️ `numOfRows`가 100이면 관광지 107건에서 **7건이 잘린다.** 상류가 늘어나도
 *    조용히 유실되지 않도록 넉넉히 잡는다. 한 번에 받아야 하는 이유는 이 목록이
 *    뼈대 병합의 후보 풀이자 이미지 2차 매칭의 검색 대상이기 때문이다 — 여기서
 *    빠진 항목은 뒤 단계에서 네트워크 호출로 다시 찾는 비용이 된다.
 */
const KOR_LIST_ROWS = 200

export async function fetchKorSpots(): Promise<KorSpot[]> {
  const lists = await Promise.all(
    [CONTENT_TYPE.TOURIST_SPOT, CONTENT_TYPE.CULTURAL_FACILITY].map((contentTypeId) =>
      fetchTourApi<KorSpot>(KOR_SERVICE, {
        numOfRows: KOR_LIST_ROWS,
        pageNo: 1,
        contentTypeId,
        ...KOR_SERVICE_LDONG_REGION,
      }),
    ),
  )

  return lists.flatMap((list) => list.items)
}

/**
 * 안동 음식점 — KorService2 단독이다
 *
 * 관광지와 달리 병합할 상대가 없다. LocgoHub는 음식점을 주지 않으므로
 * 순위도 없고 뼈대를 바꿔 낄 이유도 없다. 한 번 호출하고 끝난다.
 *
 * ⚠️ 이미지 보충(backfillImages)을 붙이지 않는다. 관광지에서 21건을 채운
 *    그 로직이 음식점에는 **0/7이다.** 원인이 다르기 때문이다.
 *      관광지  areacode가 빈 값이라 지역 조회에 안 잡힐 뿐, 이름으로 찾으면 이미지가 있다
 *      음식점  지역 조회에 정상적으로 잡히고 그 레코드에 이미지가 없다
 *    후자는 조회를 몇 번 하든 없다. 44% 결측은 SpotPhoto 폴백이 받는다. → ADR-023
 *
 * 검증(2026-08-02): 16건, 이미지 9/결측 7, tel 16건 전부 빈 값.
 */
export async function fetchFoodPlaces(): Promise<FoodPlace[]> {
  const { items } = await fetchTourApi<KorSpot>(KOR_SERVICE, {
    numOfRows: 100,
    pageNo: 1,
    contentTypeId: CONTENT_TYPE.RESTAURANT,
    ...KOR_SERVICE_LDONG_REGION,
  })

  return items.map(toFoodPlace)
}

/**
 * 연관 관광지 — "이 관광지를 찾은 사람이 함께 찾은 곳"
 *
 * 여섯 번째 관광공사 API다. hubRank와 같은 계열의 **행동 데이터**라, 거리로 고른
 * "근처에 함께 볼 곳"이 답하지 못하는 질문에 답한다 — 가깝다고 같이 보는 것은
 * 아니고, 멀어도 같이 본다.
 *
 * ⚠️ 이름으로 잇지 않는다. 상류의 `tAtsCd`·`rlteTatsCd`가 우리 `Spot.id`와
 *    **같은 값**이라 이름 매칭이 필요 없다. 실측(2026-09-11): 안동 951건 중
 *    264건이 우리 44곳으로 그대로 링크된다.
 *
 * ⚠️ 안동 밖 관광지가 섞여 온다. 걸러낸다 — 차 없이 여행하는 사람에게 옆 시군의
 *    관광지를 "함께 찾는 곳"이라고 내밀면 갈 수단이 없다.
 *
 * 실측(2026-09-11): 우리 44곳 중 **21곳**에 데이터가 있고, 관광지당 중앙값 50건이다.
 * 하회마을 → 월영교·병산서원·부용대·봉정사. 데이터가 상식과 맞는다.
 */

/** 한 관광지당 담아 두는 최대 개수. 화면은 이보다 적게 쓴다. */
const REL_KEEP = 8

/**
 * 이번 달 데이터는 대개 아직 안 올라와 있다.
 * 실측(2026-09-11): `202609` 0건, `202608` 951건. 달을 고정하면 언젠가 빈다.
 */
const REL_LOOKBACK_MONTHS = 6

/** 'YYYYMM'에서 n개월 뺀다. */
function monthsBack(ym: string, n: number): string {
  let year = Number(ym.slice(0, 4))
  let month = Number(ym.slice(4, 6)) - n
  while (month <= 0) {
    month += 12
    year -= 1
  }
  return `${year}${String(month).padStart(2, '0')}`
}

export async function fetchRelatedSpots(): Promise<Record<string, RelatedSpot[]>> {
  const thisMonth = kstToday().slice(0, 6)

  for (let back = 0; back <= REL_LOOKBACK_MONTHS; back++) {
    const baseYm = monthsBack(thisMonth, back)

    const { items } = await fetchTourApi<RelatedSpotItem>(REL_SERVICE, {
      numOfRows: 1000,
      pageNo: 1,
      baseYm,
      ...LOCGO_HUB_REGION,
    })

    if (!items.length) continue

    const grouped: Record<string, RelatedSpot[]> = {}

    for (const item of items) {
      // 안동 밖은 뺀다. 차 없이 갈 수 없는 곳을 "함께 찾는 곳"이라 부르지 않는다.
      if (item.rlteSignguCd !== LOCGO_HUB_REGION.signguCd) continue

      const list = (grouped[item.tAtsCd] ??= [])
      list.push({
        id: item.rlteTatsCd,
        name: item.rlteTatsNm,
        category: item.rlteCtgryMclsNm,
        rank: Number(item.rlteRank),
      })
    }

    for (const list of Object.values(grouped)) {
      list.sort((a, b) => a.rank - b.rank)
      list.splice(REL_KEEP)
    }

    return grouped
  }

  // 반년치를 훑어도 없으면 상류가 안동을 안 주는 것이다. 비워서 돌려준다.
  console.warn('[related] 연관 관광지 데이터를 찾지 못했다. 최근 6개월 전부 0건')
  return {}
}

/**
 * 안동 축제 — `searchFestival2` 단독이다
 *
 * **ADR-010은 "축제가 0건이라 제외한다"고 적었다. 그 0건이 조회 방식의 결과였다.**
 * 옛 지역 코드(areaCode=35)로는 실제로 0건이 오고, 법정동 코드로는 7건이 온다.
 * 관광지에서 하회마을·도산서원이 통째로 빠지던 것과 정확히 같은 결함이다.
 * → ADR-035, KOR_SERVICE_LDONG_REGION
 *
 * `areaBasedList2`에 `contentTypeId=15`를 주는 길도 있지만 쓰지 않는다.
 * 그 응답에는 `eventstartdate`가 없어서 **진행 여부를 판정할 수단이 사라진다.**
 * 축제에서 날짜를 잃으면 남는 것은 이름뿐이다.
 *
 * 조회 시작일을 넓게 주고 우리가 거른다. 이 파라미터가 "그 기간에 열리는"이
 * 아니라 "그 기간에 시작하는"이라 좁게 주면 진행 중인 축제조차 빠진다.
 * → festivalQueryStartDate
 *
 * 실측(2026-09-01): 7건, 203ms, **이미지 7/7 = 100%**(관광지는 76%),
 * 좌표·주소 전부 있음. 관광지보다 데이터가 깨끗하다.
 */
export async function fetchFestivals(): Promise<KorFestivalWithEnglish[]> {
  const { items } = await fetchTourApi<KorFestival>(KOR_FESTIVAL, {
    numOfRows: 100,
    pageNo: 1,
    arrange: 'A',
    eventStartDate: festivalQueryStartDate(),
    ...KOR_SERVICE_LDONG_REGION,
  })

  return attachEnglishFestivalNames(items)
}

/**
 * 축제에 영문 이름을 붙인다 — 조회 한 번
 *
 * 관광지의 `attachEnglishNames`와 같은 태도다. 있는 것에만 붙고 지어내지 않는다.
 * 실측(2026-09-01) 영문 3건 중 국문 7건과 이어지는 것은 탈춤페스티벌 하나다.
 * 하필 그 하나가 심사 기간에 열리는 축제라 값이 크다.
 *
 * **판정을 이름과 날짜 둘 다로 한다.** 관광지에서는 이름만 봤지만 축제는 날짜가
 * 있으므로 증거를 하나 더 쓸 수 있다. 같은 이름의 축제가 해마다 열리는 데이터라
 * 이름만 보면 작년 회차에 올해 이름을 붙이게 된다.
 *
 * 주소로 안동을 거르지 않는다(관광지는 그렇게 한다). 법정동 코드로 이미 안동만
 * 조회했고, 그 위에 **국문 7건 중 하나와 이름·날짜가 정확히 맞을 것**을 요구하므로
 * 동명이소가 끼어들 자리가 없다.
 *
 * 실패해도 던지지 않는다. 이름 한 줄이 목록 전체를 죽이면 안 된다.
 */
async function attachEnglishFestivalNames(
  festivals: KorFestival[],
): Promise<KorFestivalWithEnglish[]> {
  let english: EngFestival[]

  try {
    const { items } = await fetchTourApi<EngFestival>(ENG_FESTIVAL, {
      numOfRows: 100,
      pageNo: 1,
      arrange: 'A',
      eventStartDate: festivalQueryStartDate(),
      ...KOR_SERVICE_LDONG_REGION,
    })
    english = items
  } catch (error) {
    // 이유를 함께 적는다. 이유 없는 경고는 배포 로그에서 아무것도 말해 주지 않는다.
    console.warn('[festival] 영문 축제 조회에 실패했다. 국문 이름만 보여준다 —', reasonOf(error))
    return festivals
  }

  return festivals.map((festival) => {
    const match = english.find((candidate) => {
      if (
        candidate.eventstartdate !== festival.eventstartdate ||
        candidate.eventenddate !== festival.eventenddate
      ) {
        return false
      }

      const record = splitEngTitle(candidate.title)
      return !!record && normalizeSpotName(record.korean) === normalizeSpotName(festival.title)
    })

    const nameEn = match ? splitEngTitle(match.title)?.english : undefined
    return nameEn ? { ...festival, nameEn } : festival
  })
}

/**
 * 이름에서 읽어낼 수 있는 향토음식 — ADR-023
 *
 * API는 한식/카페만 준다. 그런데 "안동 식도락"에서 찜닭과 헛제삿밥이
 * 한식에 묻히면 이 탭이 존재할 이유가 없어진다. 그래서 **이름이 스스로
 * 밝히는 것만** 태깅한다. 근거가 응답 안에 있으므로 누구든 다시 만들 수 있다.
 *
 * 간고등어(옥야식당·일직식당)는 넣지 않는다. 이름에 안 드러나고, 그걸 아는 건
 * 사람이지 API가 아니다. 손으로 채우면 출처가 사라진다. → ADR-023
 *
 * ⚠️ 이 목록을 늘릴 때는 실제 16건의 title부터 확인할 것. 상호에 없는 단어를
 *    패턴으로 넣으면 영원히 0건인 칩이 생긴다.
 */
const FOOD_NAME_PATTERNS: ReadonlyArray<{ category: FoodCategory; pattern: RegExp }> = [
  // 안동 유진찜닭
  { category: '찜닭', pattern: /찜닭/ },
  // 맛50년 헛제사밥 · 헛제사밥까치구멍집 — 상호 표기는 '헛제사밥'이다.
  // 화면 분류명은 표준어 '헛제삿밥'을 쓰므로 둘 다 받는다.
  { category: '헛제삿밥', pattern: /헛제사밥|헛제삿밥/ },
]

/**
 * 음식점 한 건의 분류
 *
 * 카페 판정을 먼저 한다. 한식/카페 구분은 API가 직접 준 답이라
 * 이름 추측보다 강하다. 향토음식 태깅은 그 한식 안에서만 한다.
 *
 * ⚠️ `lclsSystm2`를 먼저 본다. 법정동 코드로 조회한 레코드는 `cat3`가 빈 문자열로
 *    오기 때문이다(실측 2026-09-10, 새 13곳 전부). `cat3`만 보던 시절에는
 *    브레드 79·아차가·월영당이 카페인데 한식으로 분류됐다. → ADR-039
 *
 *    둘 다 확인한다. 어느 한쪽이 비어도 나머지가 답한다.
 */
export function foodCategoryOf(kor: KorSpot): FoodCategory {
  if (kor.lclsSystm2 === FOOD_LCLS.CAFE || kor.cat3 === FOOD_CAT3.CAFE) return '카페'

  return FOOD_NAME_PATTERNS.find(({ pattern }) => pattern.test(kor.title))?.category ?? '한식'
}

/** KorService2 한 건 → 화면용 음식점. 병합 상대가 없으므로 mergeSpot과 달리 단독 변환이다. */
function toFoodPlace(kor: KorSpot): FoodPlace {
  return {
    id: kor.contentid,
    name: kor.title,
    // LocgoHub에 음식점이 없다. 순위가 "아직 없다"가 아니라 "존재하지 않는다".
    rank: null,
    category: foodCategoryOf(kor),
    lat: Number(kor.mapy),
    lng: Number(kor.mapx),
    // 관광지와 같은 규칙 — 없는 값은 빈 문자열이 아니라 부재로 남긴다.
    ...(kor.addr1 ? { address: kor.addr1 } : {}),
    ...(kor.firstimage ? { imageUrl: httpsImage(kor.firstimage) } : {}),
    contentId: kor.contentid,
  }
}

/**
 * 여행자 목록에서 걷어낼 이름 패턴 — ADR-022
 *
 * LocgoHub는 통신사 방문 데이터 기반이라 "사람이 많이 간 곳"을 준다.
 * 그건 "여행자가 갈 만한 곳"과 다르다. 골프장·영화관·역·체육시설이
 * 순위 상위권에 섞여 들어온다. 6위 안동역, 17위 남안동CC 같은 식이다.
 *
 * 카테고리로 자르지 않는다. 상류 분류가 목적과 어긋나기 때문이다.
 * CGV와 하회세계탈박물관이 똑같이 '문화관광'이고,
 * 남안동CC와 선성수상길이 똑같이 '레저스포츠'다. 카테고리를 자르면 둘 다 날아간다.
 *
 * 이름 패턴은 무딘 도구지만 여기서는 그게 맞다. 걷어낼 대상이 전부
 * 이름에 정체를 드러내고 있고, 무엇이 왜 빠졌는지 읽어서 감사할 수 있다.
 *
 * ⚠️ 이 목록은 늘어난다. 새 항목을 넣기 전에 실제 응답에서 오탐부터 확인할 것.
 */
const NOISE_PATTERNS: ReadonlyArray<{ reason: string; pattern: RegExp }> = [
  // 남안동CC · 안동레이크GC · 리버힐CC
  { reason: '골프장', pattern: /(?:CC|GC|컨트리클럽)$/ },
  // CGV/안동 · 롯데시네마/프리미엄안동
  { reason: '영화관', pattern: /CGV|시네마|메가박스/ },
  // 안동역 · 안동터미널 · 옹천역(폐역)
  // 도착지점이지 방문지가 아니다. 정류장 안내는 버스 API가 따로 한다.
  { reason: '교통시설', pattern: /역$|터미널/ },
  // 안동드림베이스볼파크 · 안동강변구장 · 용상체육공원/야구장 · 안동시생활체육공원
  { reason: '체육시설', pattern: /체육공원|야구장|구장$|베이스볼/ },
  // 안동시농산물도매시장 · 안동수산물도매시장 · 안동청과합자회사
  // 전통시장(중앙신시장·안동구시장·구담시장)은 남긴다. 그건 여행자가 간다.
  { reason: '도매시장', pattern: /도매시장|합자회사/ },
]

/**
 * 여행자 목록에 넣지 않을 이름인가
 *
 * LocgoHub가 별칭·상태를 슬래시 뒤에 붙이므로("옹천역/폐역") 앞부분으로 판정한다.
 * 뒤까지 보면 "한국국학진흥원/KSI연수원" 같은 정상 항목이 엉뚱한 패턴에 걸린다.
 */
export function noiseReason(name: string): string | null {
  const base = name.split('/')[0]!.trim()
  return NOISE_PATTERNS.find(({ pattern }) => pattern.test(base))?.reason ?? null
}

/**
 * KorService2 키워드 검색 — 풀에도 없는 것을 전국에서 이름으로 찾는다
 *
 * 예전에는 이 함수가 하회마을·도산서원·월영교를 구제하는 유일한 길이었다. 지금은
 * 아니다. **그 항목들은 법정동 코드로 조회하면 처음부터 풀 안에 있다**
 * (→ KOR_SERVICE_LDONG_REGION). ADR-004는 "KorService2에 없다"고, 08-02는 "이름으로
 * 재검색해야 찾을 수 있다"고 적었는데 둘 다 같은 증상을 다르게 본 것이었다.
 *
 * 남은 역할은 좁다. 풀(관광지 12 + 문화시설 14)에 없는 타입의 항목이다 —
 * 실측 4건이 여기서 걸린다(레포츠·쇼핑 등 다른 contentTypeId로 등재된 것들).
 *
 * 지역 필터를 걸지 않는다. 지역으로 잡히는 것은 이미 풀에 있으므로, 여기까지
 * 내려온 항목에 지역 필터를 거는 것은 같은 그물을 한 번 더 던지는 일이다.
 * 전국에서 찾아온 뒤 좌표로 거른다.
 *
 * 실패해도 던지지 않는다. 이건 보강이지 본체가 아니다.
 * 키워드 하나가 실패했다고 목록 전체가 502가 되면 안 된다.
 */
async function searchKorSpots(keyword: string): Promise<KorSpot[]> {
  try {
    const { items } = await fetchTourApi<KorSpot>(KOR_SEARCH, {
      numOfRows: 20,
      pageNo: 1,
      keyword,
    })
    return items
  } catch {
    return []
  }
}

/**
 * 검색어 후보 — 넓은 것부터
 *
 * LocgoHub는 시군명을 앞에 붙이고("안동하회마을") 상태·별칭을 뒤에 붙인다
 * ("낙강물길공원/공사중(2028년12월31일개장예정)"). 그대로 검색하면 0건이다.
 *
 * 최대 2개로 묶는다. 결측이 46건이라 후보를 늘리면 호출 수가 그대로 곱해진다.
 */
export function keywordVariants(name: string): string[] {
  const base = name
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .split('/')[0]!
    .trim()

  if (!base) return []
  // "안동하회마을" → "하회마을". 2글자만 남는 축약은 만들지 않는다.
  return base.startsWith('안동') && base.length > 4 ? [base, base.slice(2)] : [base]
}

/**
 * 이름 매칭(2·3차)에서 같은 장소로 볼 최대 거리(m)
 *
 * 지역 조회 매칭(200m)보다 훨씬 넉넉하다. 이름으로 찾아낸 후보이므로
 * 여기서는 이름이 주 증거고 거리는 위생 검사다.
 * 실측: CGV/안동의 최근접 후보가 185km 떨어진 "CGV 강남점"이었다. 거리가 걸러냈다.
 *
 * 완전일치에 3km를 주는 이유는 두 API의 대표 좌표가 다른 지점을 가리키기 때문이다.
 * 하회마을은 LocgoHub 좌표와 KorService2 좌표가 1,580m 벌어진다. **200m 게이트가
 * 놓치는 것이 바로 이것이고, 2차 로컬 매칭이 존재하는 이유다.**
 */
const BACKFILL_EXACT_RADIUS_M = 3000

/**
 * 포함관계(0.9)일 때의 최대 거리(m)
 *
 * 완전일치보다 훨씬 조인다. 이름이 더 길다는 건 다른 장소일 수 있다는 뜻이다.
 * "하회마을"을 585m 떨어진 "하회마을 겸암정사"가 삼키는 것을 막는다.
 */
const BACKFILL_PARTIAL_RADIUS_M = 500

/**
 * 키워드 검색 동시 실행 수
 *
 * TourAPI 한 번이 2~3초씩 걸린다. 순차로 돌리면 안 된다.
 * 실측: 6 → 31초, 12 → 16초. 대상이 46곳이던 시절의 숫자다.
 *
 * 지금은 2차 로컬 매칭이 앞에서 걸러 대상이 13곳이라 이 단계가 0.7초에 끝난다.
 * 동시 실행 수를 더 올릴 이유가 없다 — 공공 API에 부담만 준다.
 */
const BACKFILL_CONCURRENCY = 12

/**
 * 이미지가 없는 관광지를 채운다 — 풀 안에서 먼저, 그래도 없으면 검색으로
 *
 * **2차(로컬)** 이미 받아 둔 `pool`을 이름으로 다시 훑는다. 네트워크를 쓰지 않는다.
 * **3차(검색)** 풀에도 없는 것만 전국 `searchKeyword2`로 찾는다.
 *
 * 2차가 왜 성립하나: 1차 병합은 좌표 200m 게이트라(→ matchKorSpot) 두 API의 대표
 * 좌표가 다른 지점을 가리키는 항목을 놓친다. 하회마을이 1,580m 벌어져 대표적이다
 * (ADR-021). **그런데 그 레코드는 이미 풀 안에 있다.** 법정동 코드로 조회하기
 * 시작하면서 생긴 조건이다. 없는 것을 찾으러 나가던 호출이 이미 손안에 있는 것을
 * 다시 보는 일이 됐다.
 *
 * 판정 규칙은 3차와 똑같다(→ pickByName). 유사도가 1순위, 거리가 2순위다.
 * 거리만으로 고르면 틀린다 — 하회마을의 최근접 후보는 585m의 "겸암정사"이고
 * 본체는 1,580m로 더 멀다. 실제로 2차가 `contentid 894027`(본체)을 유사도 1.00으로
 * 집어낸다.
 *
 * 실측(2026-08-23, 54곳): 1차 30 → 2차 +6 → 3차 +4 → 갤러리 +1 = 41곳(76%).
 * 이미지 비율은 옛 방식과 같고, 이 함수의 TourAPI 호출만 **수십 회에서 21회로** 준다.
 */
export async function backfillImages(spots: Spot[], pool: KorSpot[]): Promise<Spot[]> {
  const found = new Map<string, KorSpot>()

  for (const spot of spots) {
    if (spot.imageUrl) continue

    const best = pickByName(spot, pool)
    if (best) found.set(spot.id, best)
  }

  const targets = spots.filter((spot) => !spot.imageUrl && !found.has(spot.id))

  await mapWithLimit(targets, BACKFILL_CONCURRENCY, async (spot) => {
    for (const keyword of keywordVariants(spot.name)) {
      const best = pickByName(spot, await searchKorSpots(keyword))
      if (!best) continue

      found.set(spot.id, best)
      // 완전일치면 더 볼 것이 없다. 남은 검색어를 건너뛰어 호출을 아낀다.
      if (nameSimilarity(spot.name, best.title) === 1) return
    }
  })

  return spots.map((spot) => {
    const kor = found.get(spot.id)
    if (!kor) return spot

    return {
      ...spot,
      imageUrl: httpsImage(kor.firstimage),
      // 주소도 같이 비어 있었다면 함께 채운다. 같은 항목에서 온 값이다.
      ...(spot.address ? {} : kor.addr1 ? { address: kor.addr1 } : {}),
      ...(spot.contentId ? {} : { contentId: kor.contentid }),
    }
  })
}

/**
 * 관광사진 갤러리로 마지막 보충 — 한국관광공사 PhotoGalleryService1
 *
 * KorService2가 사진을 주지 못한 것들이 남는다. 그때 다른 웹사이트를 뒤지지 않는다.
 * **공공데이터 API 안에서만 해결한다.** 같은 공사가 따로 운영하는 사진 데이터셋이
 * 마지막 보루다.
 *
 * ⚠️ 관광지마다 부르지 않는다. `keyword=안동`으로 한 번에 받아 이름을 맞춘다.
 *    결측이 14곳이라 개별 호출하면 14번인데, 어차피 안동 사진 전체가 1500건이라
 *    한 번에 받는 편이 싸고 정확하다(제목에 없는 이름이 태그에 있는 경우를 잡는다).
 *
 * ⚠️ **좌표가 없다.** 지역 조회(200m)나 키워드 보충(3km)과 달리 거리로 검증할 수
 *    없다. 그래서 촬영장소가 안동인 것만 남기고, 이름은 조각 단위로 맞춘다.
 *    동명이소를 거를 수단이 촬영장소뿐이므로 이 조건을 빼면 안 된다.
 *
 * 실측(2026-08-14): 안동 사진 1504건 중 1000건 수신, 촬영장소가 안동인 것 994건.
 * 관광지 54곳 중 17곳이 걸리고, 그중 **사진이 없던 것은 1곳**(부용대)이다.
 * 나머지 13곳은 행사·신규시설·상호여서 공공데이터 어디에도 사진이 없다.
 * 보충량은 작지만, KorService2가 흔들릴 때 남는 유일한 사진 소스이기도 하다.
 *
 * 실패해도 던지지 않는다. 보강이지 본체가 아니다.
 */
export async function backfillFromGallery(spots: Spot[]): Promise<Spot[]> {
  const targets = spots.filter((spot) => !spot.imageUrl)
  if (targets.length === 0) return spots

  let photos: GalleryPhoto[]

  try {
    const { items } = await fetchTourApi<GalleryPhoto>(PHOTO_GALLERY, {
      numOfRows: 1000,
      pageNo: 1,
      arrange: 'A',
      keyword: GALLERY_KEYWORD,
    })
    // 촬영장소가 안동인 것만. 좌표가 없으니 이게 유일한 지역 검증이다.
    photos = items.filter((photo) => photo.galPhotographyLocation?.includes(GALLERY_KEYWORD))
  } catch {
    console.warn('[gallery] 관광사진 조회에 실패했다. 사진 없이 진행한다')
    return spots
  }

  const found = new Map<string, GalleryPhoto>()

  for (const spot of targets) {
    const photo = photos.find((candidate) =>
      nameFragments(spot.name).some(
        (fragment) =>
          normalizeSpotName(candidate.galTitle).includes(fragment) ||
          normalizeSpotName(candidate.galSearchKeyword ?? '').includes(fragment),
      ),
    )
    if (photo) found.set(spot.id, photo)
  }

  return spots.map((spot) => {
    const photo = found.get(spot.id)
    if (!photo) return spot

    return { ...spot, imageUrl: httpsImage(photo.galWebImageUrl) }
  })
}

/** 갤러리 검색어이자 촬영장소 필터. 이 서비스는 지역 코드를 받지 않는다. */
const GALLERY_KEYWORD = '안동'

/**
 * 영문 레코드의 제목에서 국문 이름만 떼어낸다
 *
 * EngService2의 제목은 `영문 (국문)` 꼴이고 국문이 **언제나 끝**에 온다.
 * 그래서 뒤에서부터 짝이 맞는 괄호를 찾아 그 안에 한글이 있을 때만 자른다.
 *
 * ⚠️ `replace(/\s*\(.*$/, '')`처럼 첫 괄호부터 지우면 안 된다. 영문 주석이
 *    괄호로 붙는 제목이 있어("Andong Gunja Village (Ocheon Historic Site) (안동 …)")
 *    그 설명까지 함께 날아간다. 중첩 괄호도 있어 정규식 한 줄로는 안 된다.
 */
function splitEngTitle(title: string): { english: string; korean: string } | null {
  let rest = title.trim()
  let korean = ''

  while (rest.endsWith(')')) {
    let depth = 0
    let open = -1

    for (let i = rest.length - 1; i >= 0; i--) {
      if (rest[i] === ')') depth++
      else if (rest[i] === '(' && --depth === 0) {
        open = i
        break
      }
    }

    const group = open >= 0 ? rest.slice(open) : ''
    if (!group || !/[가-힣]/.test(group)) break

    korean = group.slice(1, -1)
    rest = rest.slice(0, open).trim()
  }

  /**
   * 대괄호 꼬리는 이름이 아니다. 상류가 등재 사실을 제목에 붙여 준다
   * ("Dosanseowon Confucian Academy [UNESCO World Heritage]"). 국문 쪽은
   * "도산서원"으로만 나오므로, 그대로 두면 영문 화면에서만 제목이 두 배로 길어진다.
   * 괄호 안의 영문 주석("(Ocheon Historic Site)")은 이름의 일부라 남긴다.
   */
  const english = rest.replace(/\s*\[[^\]]*\]/g, '').trim()

  return korean && english ? { english, korean } : null
}

/**
 * 이 영문 레코드가 이 관광지인가
 *
 * ⚠️ 여기가 오탐이 나던 자리다. 예전에는 양방향 `includes`였는데, 그러면
 *    **도산서원선비문화수련원이 "Dosanseowon Confucian Academy"가 된다.**
 *    이름이 포함관계라는 것만으로는 같은 곳이라는 증거가 안 된다 — 우리 이름이
 *    더 길면 그건 보통 "그 안에 있는 다른 시설"이다.
 *
 * 그래서 방향을 나눈다. LocgoHub 이름의 슬래시 별칭을 먼저 가른 뒤
 *   조각 == 상류 국문명                         같은 곳이다
 *   상류 국문명이 조각으로 **시작**한다          같은 곳을 더 길게 적었을 뿐이다
 *                                              ("묵계서원" ↔ "묵계서원 및 안동김씨 묵계종택")
 *   그 외(우리 쪽이 더 김)                       다른 곳으로 본다
 */
function isSameEngPlace(spotName: string, korean: string): boolean {
  const target = normalizeSpotName(korean)
  if (!target) return false

  return nameFragments(spotName).some(
    (fragment) => fragment === target || (fragment.length >= 3 && target.startsWith(fragment)),
  )
}

/**
 * 영문 레코드가 안동 것인가 — 동명이소 차단
 *
 * ⚠️ `searchKeyword2`는 **전국**을 뒤진다. 이 검사가 없으면 실제로 이렇게 된다.
 *      안동시립박물관    → 강릉시 오죽헌/시립박물관  (Gangneung-si)
 *      백조공원/음악분수 → 방축천 음악분수          (Sejong-si)
 *      천년숲           → 경북천년숲정원           (Gyeongju-si)
 *    셋 다 이름은 그럴듯하게 겹친다. 거를 수단이 주소뿐이다.
 *
 * 좌표로 거르지 않는 이유는 ADR-021이다. 두 데이터셋의 대표 좌표가 다른 지점을
 * 가리켜 하회마을만 1,580m가 벌어진다. 주소의 시군명이 훨씬 단단하다.
 * 실측: 안동 영문 레코드 32건 전부 `addr1`에 `Andong-si`가 있다.
 */
const ANDONG_IN_ENG_ADDRESS = /Andong-si/i

/** 영문 레코드 한 건을 조회 가능한 꼴로. 안동이 아니거나 국문명이 없으면 버린다. */
function toEngRecord(item: EngSpot): EngRecord | null {
  if (!ANDONG_IN_ENG_ADDRESS.test(item.addr1 ?? '')) return null

  const split = splitEngTitle(item.title)
  if (!split) return null

  // ID 둘을 함께 들고 간다. 이름만 가지고는 영문 `detailIntro2`를 부를 수 없다.
  return { ...split, contentId: item.contentid, contentTypeId: item.contenttypeid }
}

/**
 * 영문 이름을 붙인다 — EngService2 조회 한 번
 *
 * 상류에 있는 만큼만 붙는다. 지어내지 않는다. 없으면 국문이 그대로 나가고,
 * 그건 결함이 아니라 사실이다. 여행자가 현장에서 볼 간판·정류장 표지가 국문이라
 * 우리만 아는 로마자 이름을 만들면 그 이름으로는 길을 물을 수도 없다. → ADR-030
 *
 * **예전에는 세 단계였다.** 지역 조회(32건) → 광역 검색 → 이름 재검색. 3단계가
 * 관광지에서만 44회를 더 썼고, 그렇게까지 해야 월영교·부용대·만휴정이 붙었다.
 *
 * 법정동 코드로 조회하면 한 번에 57건이 오고 **그 세 단계 전체와 결과가 같다.**
 * 실측(2026-08-23, 54곳 대조):
 *
 *   현행 3단계(호출 2 + 40회)   17곳
 *   법정동 코드 1회             17곳   ← 같은 17곳, 영문 표기까지 동일
 *   법정동 + 옛 2단계(3회)      57레코드 = 법정동 단독과 같은 집합
 *
 * 마지막 줄이 광역 검색을 지운 근거다. 옛 두 경로가 주는 레코드는 법정동 조회에
 * **전부 포함**된다. 남겨 두면 호출 한 번이 늘 뿐 새로 걸리는 것이 없다.
 * 이름 재검색도 남은 37곳에 40회를 써서 **0곳**을 더 찾았다.
 *
 * 유일한 차이는 안동군자마을이 `Andong Gunja Village`에서
 * `Andong Gunja Village (Ocheon Historic Site)`가 되는 것인데, 괄호 안이 그 마을의
 * 다른 이름이라 남기기로 이미 정해 둔 쪽이다(→ decisions.md, splitEngTitle).
 *
 * ⚠️ `contentTypeId`를 넘기지 않는다. 국문의 12(관광지)/39(음식점)와 코드 체계가
 *    달라서(안동 레코드는 75·76·78·80·82·85) 지정하면 0건이 된다.
 *
 * ⚠️ contentId로 잇지 않는다. 두 서비스는 ID 체계가 별개다 — 실측(2026-08-19):
 *    국문 32건과 영문 32건의 contentid 교집합 **0건**이고, 서로의 ID를 반대편
 *    `detailCommon2`에 넣으면 totalCount 0이다. 연결 고리는 제목 괄호 안 국문명뿐이다.
 *
 * 실패해도 던지지 않는다. 이름 한 줄이 본체를 죽이면 안 된다.
 */

/**
 * 영문 이름 풀 — **성공한 것만 캐시된다**
 *
 * ⚠️ 여기서 try/catch를 하지 않는 것이 요점이다. 던지면 `defineCachedFunction`이
 *    아무것도 저장하지 않고, 다음 요청이 다시 시도한다. 실패를 캐시에 넣지 않는다.
 *
 *    예전에는 이 조회가 `/api/spots`의 **캐시된 본문 안에서** 돌았고 실패를
 *    조용히 삼켰다. 그래서 상류가 한 번 흔들리면 그 결과가 **하루 동안 얼어붙었다.**
 *    실측(2026-09-10): 배포본이 관광지 영문명 0/44, 음식점 0/28을 내보내고 있었다.
 *    로컬은 같은 코드로 17/44였다. `/en` 화면 전체가 국문 이름으로 나갔다는 뜻이다.
 *
 *    축제가 이미 같은 처방을 쓰고 있었다 — 목록은 캐시하고 판정은 요청 시점에.
 *    → ADR-035 · ADR-040
 */
type EngRecord = {
  english: string
  korean: string
  contentId: string
  contentTypeId: string
}

/**
 * ⚠️ `defineCachedFunction`을 **모듈 최상위에서 부르지 않는다.** 이 파일은
 *    `scripts/check-spot-match.ts`가 node로 직접 들여온다. 최상위에서 부르면
 *    Nitro 자동 임포트가 없는 그 환경에서 임포트 순간 ReferenceError가 난다
 *    (실제로 그렇게 회귀 스크립트를 깨뜨렸다). 첫 호출 때 만든다.
 */
let cachedEnglishPool: (() => Promise<EngRecord[]>) | null = null

function englishPool(): Promise<EngRecord[]> {
  cachedEnglishPool ??= defineCachedFunction(
    async (): Promise<EngRecord[]> => {
      const { items } = await fetchTourApi<EngSpot>(ENG_SERVICE, {
        numOfRows: KOR_LIST_ROWS,
        pageNo: 1,
        ...KOR_SERVICE_LDONG_REGION,
      })

      return items.flatMap((item) => {
        const record = toEngRecord(item)
        return record ? [record] : []
      })
    },
    {
      maxAge: 60 * 60 * 24, // 1일
      name: 'tour-english',
      getKey: () => 'all',
    },
  )

  return cachedEnglishPool()
}

/**
 * 마지막 실패 시각 — 죽은 상류를 요청마다 다시 두드리지 않는다
 *
 * 영문 붙이기를 캐시 밖으로 꺼내면서(ADR-040) 생긴 위험이다. 성공은 1일 캐시되지만
 * **실패는 캐시되지 않으므로**, 상류가 계속 죽어 있으면 모든 요청이 실패하는 호출을
 * 한 번씩 더 하게 된다. 그건 화면을 느리게 만들 뿐 아무것도 고치지 못한다.
 *
 * 1분만 쉬었다 다시 시도한다. 캐시가 아니라 **재시도 간격**이다 — 하루를 얼리는
 * 것과 다르다. 상류가 살아나면 1분 안에 화면이 영문으로 돌아온다.
 */
let englishFailedAt = 0
const ENGLISH_RETRY_MS = 60_000

export async function attachEnglishNames<T extends Spot>(spots: T[]): Promise<T[]> {
  if (englishFailedAt && Date.now() - englishFailedAt < ENGLISH_RETRY_MS) return spots

  let pool: EngRecord[]

  try {
    pool = await englishPool()
    englishFailedAt = 0
  } catch (error) {
    englishFailedAt = Date.now()
    /**
     * ⚠️ 이유를 함께 적는다. 이 한 줄이 배포 로그에서 유일한 단서다.
     *    실측(2026-09-10): 같은 키·같은 호스트인데 KorService2는 되고 EngService2만
     *    배포본에서 빈손으로 온다. 로컬(한국)에서는 136ms에 57건이 온다. → ADR-040
     */
    console.warn('[eng] 영문 관광정보 조회에 실패했다. 국문으로 나간다 —', reasonOf(error))
    return spots
  }

  if (!pool.length) {
    // 오류 없이 0건이 오는 경우가 이 프로젝트에 이미 있었다(lDongSignguCd 47170).
    console.warn('[eng] 영문 관광정보가 0건으로 왔다. 오류는 아니지만 이름이 안 붙는다')
    return spots
  }

  return spots.map((spot) => {
    const nameEn = pool.find((record) => isSameEngPlace(spot.name, record.korean))?.english
    return nameEn ? { ...spot, nameEn } : spot
  })
}

/**
 * 이용 안내 필드 이름 — **콘텐츠 타입마다 다르다**
 *
 * 이게 이 조회에서 유일하게 어려운 부분이다. `detailIntro2`는 타입별로 응답 스키마가
 * 통째로 다르다. 관광지는 `usetime`인데 문화시설은 `usetimeculture`, 쇼핑은
 * `opentime`이다. 처음 재 볼 때 이걸 모르고 `usetime`만 봤다가 **문화시설 9곳이
 * 전부 빈칸으로 나왔다.**
 *
 * 타입 코드로 표를 만들지 않고 후보 이름을 늘어놓는다. 이유가 둘이다.
 *   1. 영문 서비스는 타입 코드 체계가 아예 다르다(75·76·78…). 표를 두 벌 들고
 *      있어야 하는데, 실제로 다른 것은 **접미사뿐**이다.
 *   2. 못 보던 타입이 하나 들어와도 이름이 같은 규칙이면 그냥 걸린다.
 *
 * 비어 있지 않은 첫 값을 쓴다. 한 응답에 둘이 함께 오는 경우는 없다.
 */
const INTRO_KEYS = {
  useTime: ['usetime', 'usetimeculture', 'usetimeleports', 'opentime', 'opentimefood'],
  restDate: [
    'restdate',
    'restdateculture',
    'restdateleports',
    'restdateshopping',
    'restdatefood',
  ],
  parking: ['parking', 'parkingculture', 'parkingleports', 'parkingshopping', 'parkingfood'],
  /** 관람료. 문화시설·레포츠에만 있다. 관광지(12)에는 필드 자체가 없다. */
  fee: ['usefee', 'usefeeleports'],
  tel: [
    'infocenter',
    'infocenterculture',
    'infocenterleports',
    'infocentershopping',
    'infocenterfood',
  ],
} as const

/**
 * 상류 문장을 화면에 낼 꼴로
 *
 * ⚠️ 이 값들에는 **HTML이 섞여 온다.** `<br>`로 줄을 나누고 `&amp;`로 &를 적는다.
 *    그대로 인쇄하면 "09:00~18:00&lt;br&gt;입장 마감 17:30"이 화면에 뜬다.
 *
 * 줄바꿈은 살린다 — 하절기/동절기가 한 줄에 붙으면 읽을 수 없다. 대신 빈 줄은
 * 걷어낸다. 상류가 `<br><br>`을 자주 쓴다.
 */
function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/**
 * 이용 안내 값 전용 — 계절 머리표 앞에서 한 번 더 줄을 나눈다
 *
 * 상류가 구분자 없이 붙여 준다. 하회마을 실측값이 이렇다.
 *   `[하절기(4월~9월)]- 09:00~18:00 - 입장 마감 17:30[동절기(10월~3월)]- 09:00~17:00`
 * 두 시간표가 한 문장이 되어 읽을 수 없다. 글자는 하나도 바꾸지 않고 줄만 나눈다.
 *
 * ⚠️ **설명(`overview`)에는 쓰지 않는다.** 저쪽은 산문이라 "[국보 132호]" 같은
 *    대괄호가 문장 한가운데 올 수 있고, 그때 줄을 나누면 문장이 끊긴다.
 *    오늘 44곳에서는 한 건도 안 걸렸지만, 안 걸린다는 것과 안전하다는 것은 다르다.
 */
function cleanIntro(value: unknown): string {
  return cleanText(value)
    .replace(/(?<=\S)\[/g, '\n[')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

/** 후보 이름 중 비어 있지 않은 첫 값. 없으면 undefined — 빈 문자열을 남기지 않는다. */
function pickIntro(item: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = cleanIntro(item[key])
    if (value) return value
  }

  return undefined
}

/**
 * 상세 응답의 item은 배열일 때도, 객체 하나일 때도 있다.
 * 목록 조회와 달리 이 엔드포인트들은 그 꼴이 일정하지 않다.
 */
function firstItem<T>(items: T[]): Record<string, unknown> | null {
  const list = Array.isArray(items) ? items : [items as T]
  return (list[0] as Record<string, unknown> | undefined) ?? null
}

/** 국문 이용 안내. contentId가 없는 곳(44곳 중 9곳)은 물어볼 수단이 없다. */
async function korGuide(spot: Spot): Promise<SpotGuide> {
  if (!spot.contentId) return {}

  // 타입 코드를 모르면 detailIntro2를 부를 수 없다. 목록에는 그 값이 없어서 한 번 더 묻는다.
  const common = await fetchTourApi<unknown>(KOR_DETAIL_COMMON, { contentId: spot.contentId })
  const header = firstItem(common.items)

  /**
   * 설명은 **이 응답 안에 이미 들어 있다.**
   *
   * 타입 코드를 얻으려고 부른 조회인데, 같은 본문에 `overview`가 실려 온다.
   * 그동안 그걸 버리고 있었다 — 상세 화면의 "이런 곳이에요"가 한 번도 뜬 적이
   * 없던 이유다. 추가 호출 없이 35곳의 설명이 붙는다. → ADR-047
   */
  const overview = optional('overview', cleanText(header?.overview) || undefined)

  const contentTypeId = String(header?.contenttypeid ?? '')
  if (!contentTypeId) return overview

  const intro = await fetchTourApi<unknown>(KOR_DETAIL_INTRO, {
    contentId: spot.contentId,
    contentTypeId,
  })
  const item = firstItem(intro.items)
  if (!item) return overview

  return {
    ...overview,
    ...optional('useTime', pickIntro(item, INTRO_KEYS.useTime)),
    ...optional('restDate', pickIntro(item, INTRO_KEYS.restDate)),
    ...optional('parking', pickIntro(item, INTRO_KEYS.parking)),
    ...optional('fee', pickIntro(item, INTRO_KEYS.fee)),
    ...optional('tel', pickIntro(item, INTRO_KEYS.tel)),
  }
}

/**
 * 영문 이용 안내 — 이름으로 이어 붙인다
 *
 * ⚠️ 국문 contentId로는 못 부른다. 두 서비스는 ID 체계가 별개다(교집합 0건).
 *    유일한 연결 고리가 영문 제목 괄호 안의 국문명이라, 영문명을 붙일 때 쓰는
 *    그 풀을 그대로 쓴다. → `attachEnglishNames`
 *
 * 실측(2026-09-11): 영문 풀에 걸리는 17곳 중 운영시간·휴무일이 실제로 있는 곳은
 * 13곳이다. 나머지는 국문 값이 영문 화면에 그대로 나간다 — 지어내지 않는다.
 */
async function engGuide(spot: Spot): Promise<SpotGuide> {
  const pool = await englishPool()
  const record = pool.find((candidate) => isSameEngPlace(spot.name, candidate.korean))

  /**
   * ⚠️ ID 둘이 다 있어야 부른다. 없는데 부르면 쿼리에 `undefined`가 실려 나가고
   *    상류가 오류로 답한다 — 개발에서 실제로 그렇게 실패했다. 풀은 1일 캐시라,
   *    레코드에 ID를 더한 그날 **어제 꼴로 저장된 값**이 그대로 살아 있었다.
   *    캐시된 자료 구조를 넓힐 때 늘 있는 일이므로 읽는 쪽에서 막는다.
   */
  if (!record?.contentId || !record.contentTypeId) return {}

  /**
   * 국문과 달리 여기서는 `detailCommon2`를 **설명 때문에** 부른다. 타입 코드는
   * 목록에서 이미 받았으므로 필요 없는데, 영문 설명이 거기 있다. 실측 표본
   * 20건이 전부 있었다 — 영문 화면에서 가장 크게 비어 있던 자리다.
   *
   * 둘을 동시에 묻는다. 설명이 없어도 이용 안내는 붙어야 한다.
   */
  const [intro, common] = await Promise.all([
    fetchTourApi<unknown>(ENG_DETAIL_INTRO, {
      contentId: record.contentId,
      contentTypeId: record.contentTypeId,
    }).catch(() => null),
    fetchTourApi<unknown>(ENG_DETAIL_COMMON, { contentId: record.contentId }).catch(() => null),
  ])

  const item = intro ? firstItem(intro.items) : null
  const header = common ? firstItem(common.items) : null

  return {
    ...optional('overviewEn', cleanText(header?.overview) || undefined),
    ...(item
      ? {
          ...optional('useTimeEn', pickIntro(item, INTRO_KEYS.useTime)),
          ...optional('restDateEn', pickIntro(item, INTRO_KEYS.restDate)),
          ...optional('parkingEn', pickIntro(item, INTRO_KEYS.parking)),
          ...optional('feeEn', pickIntro(item, INTRO_KEYS.fee)),
        }
      : {}),
  }
}

/** 값이 있을 때만 키를 만든다. 이 프로젝트는 빈 문자열을 부재로 쓰지 않는다. */
function optional<K extends string>(key: K, value: string | undefined) {
  return (value ? { [key]: value } : {}) as { [P in K]?: string }
}

/**
 * 이용 안내 — "몇 시에 문 여나"에 답한다
 *
 * 국문과 영문을 **따로, 동시에** 묻는다. 서로를 기다리지 않는 이유는 화면과 같다 —
 * 영문 서비스가 죽어도 국문 안내는 떠야 하고, 그 반대도 마찬가지다. 실제로
 * 배포에서 EngService2만 혼자 403을 낸 적이 있다(ADR-040).
 *
 * 던지지 않는다. 이용 안내 한 칸이 관광지 상세 전체를 죽이면 안 된다.
 */
export async function fetchSpotGuide(spot: Spot): Promise<SpotGuide> {
  const [kor, eng] = await Promise.all([
    korGuide(spot).catch((error) => {
      console.warn('[guide] 국문 이용 안내 조회에 실패했다 —', reasonOf(error))
      return {} as SpotGuide
    }),
    engGuide(spot).catch((error) => {
      console.warn('[guide] 영문 이용 안내 조회에 실패했다 —', reasonOf(error))
      return {} as SpotGuide
    }),
  ])

  return { ...kor, ...eng }
}

/**
 * 이름에서 뽑아낸 조각들 — 갤러리 매칭과 영문명 매칭이 함께 쓴다
 *
 * LocgoHub 이름은 별칭이 슬래시로 붙는다. "낙동강12경(부용경)/부용대"에서
 * 사람이 아는 이름은 **뒤쪽**인데, 기존 `keywordVariants`는 앞부분만 쓴다.
 * 그래서 슬래시 양쪽을 모두 후보로 둔다. 실측에서 부용대가 갤러리 사진도,
 * 영문명("Buyongdae Cliff")도 이 조각으로 걸렸다.
 *
 * 두 글자 미만은 버린다. "역"·"길" 같은 조각이 아무 사진에나 걸린다.
 */
function nameFragments(name: string): string[] {
  const parts = name
    .replace(/\[.*?\]/g, '')
    .split('/')
    .flatMap((part) => [part, part.replace(/\(.*?\)/g, '')])
    .map(normalizeSpotName)
    .filter((part) => part.length >= 2)

  return [...new Set(parts)]
}

/**
 * 후보 중 이 관광지로 볼 만한 항목. 없으면 null.
 *
 * 2차(로컬 풀)와 3차(키워드 검색)가 같은 규칙을 쓴다. 후보를 어디서 얻었든
 * 판정 근거는 같아야 하기 때문이다 — 출처에 따라 기준이 달라지면 같은 장소가
 * 단계마다 다르게 붙는다.
 */
export function pickByName(spot: Spot, candidates: KorSpot[]): KorSpot | null {
  const scored = candidates
    // 이미지가 목적이다. 없는 후보는 볼 이유가 없다.
    .filter((kor) => kor.firstimage && kor.mapx && kor.mapy)
    .map((kor) => ({
      kor,
      distance: distanceMeters(spot.lat, spot.lng, Number(kor.mapy), Number(kor.mapx)),
      similarity: nameSimilarity(spot.name, kor.title),
    }))
    .filter(({ distance, similarity }) =>
      similarity === 1
        ? distance <= BACKFILL_EXACT_RADIUS_M
        : similarity >= NAME_SIMILARITY_MIN_NAME_MATCH && distance <= BACKFILL_PARTIAL_RADIUS_M,
    )
    // 유사도 내림차순, 같으면 가까운 것.
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance)

  return scored[0]?.kor ?? null
}

/**
 * 이름 매칭(2·3차)의 이름 게이트
 *
 * 지역 조회(0.4)보다 높다. 거기서는 좌표 200m가 강한 증거라 이름이 보조였지만,
 * 여기서는 반경이 3km까지 늘어나 이름이 사실상 유일한 증거다.
 */
const NAME_SIMILARITY_MIN_NAME_MATCH = 0.9

/**
 * 동시 실행 수를 제한한 map
 *
 * 결측 46건 × 최대 2개 검색어다. 전부 한꺼번에 던지면 공공 API 쪽에
 * 부담이고, 순차로 돌리면 첫 요청이 2분을 넘긴다(실측). 그 사이를 잡는다.
 */
async function mapWithLimit<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await task(items[cursor++]!)
    }
  })

  await Promise.all(workers)
}

/**
 * 이름 정규화
 *
 * 두 데이터셋이 같은 장소를 다르게 적는다.
 *   "안동하회마을"              ↔ "하회마을"   LocgoHub가 시군명을 앞에 붙인다
 *   "개목사(안동)"              ↔ "개목사"     KorService2가 동명이소를 괄호로 구분한다
 *   "도산서원 [유네스코 세계유산]" ↔ "도산서원"   KorService2가 등재 사실을 대괄호로 붙인다
 * 접두어 '안동'과 괄호·대괄호를 떼고 공백을 지운 뒤 비교한다.
 *
 * ⚠️ 대괄호를 떼지 않으면 완전일치가 포함관계로 떨어진다(1.0 → 0.9).
 *    그러면 "안동 하회마을 [유네스코 세계유산]"과 "안동 하회마을 겸암정사"가
 *    똑같이 0.9가 되어 거리로만 갈리고, 더 가까운 겸암정사가 이긴다. → 08-02 실측
 */
export function normalizeSpotName(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
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
    ...(kor?.firstimage ? { imageUrl: httpsImage(kor.firstimage) } : {}),
    ...(kor ? { contentId: kor.contentid } : {}),
  }
}
