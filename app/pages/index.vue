<script setup lang="ts">
import type { ArrivalForDestination, ArrivalWithSpots, NearbyStation, StationPin } from '#shared/types/bus'
import type { SpotBoarding, SpotBusInfo, SpotRouteInfo } from '#shared/types/static-data'
import type { Spot } from '#shared/types/tour'
import { busMinutes, distanceMeters, nearest, WALKABLE_M, walkMinutes } from '#shared/constants/location'

/**
 * 지금 여기 — 홈
 *
 * 정보 순서가 곧 이 서비스의 주장이다. → ADR-012
 *   1. 가까운 정류장의 다음 버스 (몇 분 후)
 *   2. 그 시간 안에 걸어서 갈 수 있는 곳
 *   3. 안동에서 많이 찾는 곳
 *
 * 첫 렌더는 항상 안동역 기준이다. 서버에는 위치가 없다.
 * 브라우저에서 좌표가 잡히면 세 목록이 함께 갱신된다.
 */
const t = useT()
const d = useDisplay()
const route = useRoute()
const localePath = useLocalePath()

usePageTitle(() => t.value.home.title)

const { location, locating, locate, me } = useLocation()

/** 위치 상태는 키만 들고 있다. 문구는 지금 언어로 여기서 만든다. → `useLocation` */
const placeLabel = computed(() => t.value.location[location.value.label])

/**
 * 제목은 "어디 기준인지"가 아니라 "지금 어떤 상태인지"를 말한다
 *
 * 안동 밖인 걸 아는데 "지금 안동역 부근이에요"라고 쓰면 첫 화면의 첫 문장이 거짓이 된다.
 * 서울에서 연 사람이 26px로 읽는 게 그 문장이었고, 맞는 말은 13px 안내줄에 있었다.
 * 안동역 기준이라는 사실은 그 안내줄이 계속 맡는다(`t.location.outside`).
 *
 * 순서가 중요하다. 화면을 열어 둔 채 안동을 벗어나면 label은 'current'로 남고
 * reason만 'outside'로 바뀐다(→ `useLocation`). 그때도 바깥이라는 사실이 이긴다.
 *
 * 'denied'·'unsupported'는 여기서 갈라지지 않는다 — 권한을 거부한 사람이 실제로
 * 안동에 있을 수 있어서, 그 경로에서 "안동이 아니신 것 같아요"는 또 다른 거짓이 된다.
 */
const heading = computed(() => {
  if (location.value.reason === 'outside') return t.value.home.headingOutside
  if (location.value.label === 'current') return t.value.home.headingHere
  return t.value.home.heading(placeLabel.value)
})

const locationReason = computed(() =>
  location.value.reason ? t.value.location[location.value.reason] : null,
)

const coords = computed(() => ({ lat: location.value.lat, lng: location.value.lng }))

/**
 * 목록을 통째로 받고 거리 계산은 브라우저에서 한다.
 * 좌표를 서버로 보내지 않기 위해서다. → ADR-024
 *
 * 정류장 2107건 153KB(gzip 31KB), 관광지 64건. 둘 다 라우트에서 1일 캐시된다.
 * SSR에서는 안동역 폴백 기준으로 계산되고, 브라우저에서 좌표가 잡히면
 * 같은 computed가 다시 돈다. 그때 네트워크 요청은 더 나가지 않는다.
 */
// 둘은 서로를 기다릴 이유가 없다. 줄지어 await하면 왕복이 두 번 쌓인다. → browse.vue
const [{ data: allStations }, { data: spots }] = await Promise.all([
  useFetch<StationPin[]>('/api/bus/stations', { default: () => [] }),
  useFetch<Spot[]>('/api/spots', { default: () => [] }),
])

/**
 * 목적지 — 주소에 실어 둔다
 *
 * `?to=<관광지 id>`. `useState`에 담지 않는 이유는 언어와 같다(→ ADR-031) —
 * 주소에 있어야 새로고침과 공유를 견디고, 뒤로가기로 해제된다. 상세 화면의
 * "지금 여기서 가기"가 이 주소를 만든다.
 */
const destinationId = computed(() => {
  const value = route.query.to
  return typeof value === 'string' && value ? value : null
})

/**
 * 정류장 목적지 — `?stop=<정류장 이름>`
 *
 * 관광 API에는 **교통 거점이 한 곳도 없다**(실측 2026-09-16: 44곳 중 0). 그래서
 * "안동역"·"터미널"을 검색해도 아무것도 안 나왔다. 차 없이 여행하는 사람의 마지막
 * 이동은 대개 터미널로 돌아가는 길인데, 그 목적지를 고를 방법이 없었던 셈이다.
 *
 * ⚠️ id가 아니라 **이름**이다. "안동역(안동터미널)"은 승강장이 셋이고 노선마다
 *    서는 곳이 다르다. 승강장 하나로 고정하면 다른 승강장에 서는 노선이 통째로
 *    빠진다. → `/api/stop-boarding/[name]`
 *
 * `to`와 별도 파라미터로 둔다. 한 파라미터에 접두어를 붙여 두 종류를 실으면
 * 읽는 쪽마다 그 규칙을 알아야 하고, 주소만 봐서는 무엇인지 알 수 없다.
 */
const destinationStop = computed(() => {
  const value = route.query.stop
  return typeof value === 'string' && value ? value : null
})

/**
 * 목적지 쪽 사실만 받아 온다. **내가 어디 있는지는 보내지 않는다.**
 *
 * 서버는 "이 관광지로 데려다주는 노선과 그 노선에서 탈 수 있는 정류장"까지만
 * 답하고, 내 정류장과 대조하는 계산은 아래에서 브라우저가 한다. → ADR-024
 */
const { data: boarding } = await useAsyncData<SpotBoarding | null>(
  'home-boarding',
  () => {
    if (destinationId.value) {
      return $fetch<SpotBoarding>(`/api/spot-boarding/${destinationId.value}`)
    }
    if (destinationStop.value) {
      // 없는 이름이면 404다. 던지지 않는다 — 주소를 손으로 고친 경우까지 화면이 죽으면 안 된다.
      return $fetch<SpotBoarding>(
        `/api/stop-boarding/${encodeURIComponent(destinationStop.value)}`,
      ).catch(() => null)
    }
    return Promise.resolve(null)
  },
  { watch: [destinationId, destinationStop], default: () => null },
)

/** 목적지 관광지. 이름으로 묻는 라우트(`/api/spot-bus`·`/api/spot-routes`)에 넘긴다. */
const destinationSpot = computed(
  () => spots.value.find((candidate) => candidate.id === destinationId.value) ?? null,
)

/**
 * 화면에 적을 목적지 이름. 영문이 있으면 영문으로 쓴다.
 *
 * ⚠️ 정류장 목적지(`?stop=`)는 **응답이 왔을 때만** 이름을 띄운다. 없는 이름을
 *    주소에 실어 들어온 경우까지 목적지가 있는 척하지 않기 위해서다. 검색으로
 *    고른 이름은 실제 정류장이므로 이 분기에서 걸리지 않는다. → ADR-054
 */
const destinationName = computed(() => {
  if (destinationStop.value) {
    // 응답이 왔을 때만 이름을 띄운다. 404면 목적지가 없는 화면으로 되돌아간다.
    if (!boarding.value) return null
    const station = allStations.value.find(
      (candidate) => candidate.stationNm === destinationStop.value,
    )
    return station ? d.stationName(station) : destinationStop.value
  }
  if (!destinationId.value) return null
  return destinationSpot.value ? d.name(destinationSpot.value) : (boarding.value?.spot ?? null)
})

/**
 * 돌아오는 편 · 막차 — 목적지를 정했을 때만 묻는다
 *
 * 둘을 따로 부르는 이유는 근거가 다르기 때문이다. 합치지 않는 것이 이 프로젝트의
 * 규칙이고(→ `spot-routes/[spot].get.ts`), 하나가 없어도 다른 하나는 화면에 남아야 한다.
 *
 *   `/api/spot-bus`     사람이 확인한 7곳만. 404가 정상 응답이다 — **던지지 않는다.**
 *   `/api/spot-routes`  44곳 전부. 시내로 나오는 노선을 주지만 시각은 없다.
 *
 * ⚠️ 이 서비스에서 가장 위험한 실패가 "갈 수는 있는데 못 돌아오는" 안내다(ADR-016).
 *    그 사실을 상세 화면까지 들어가야 볼 수 있게 두면, 홈에서 목적지를 정하고 버스에
 *    오른 사람은 모른 채 떠난다.
 */
const { data: destinationBus } = await useAsyncData<SpotBusInfo | null>(
  'home-destination-bus',
  () =>
    destinationSpot.value
      ? $fetch<SpotBusInfo>(`/api/spot-bus/${encodeURIComponent(destinationSpot.value.name)}`).catch(
          () => null,
        )
      : Promise.resolve(null),
  { watch: [destinationId], default: () => null },
)

const { data: destinationRoutes } = await useAsyncData<SpotRouteInfo | null>(
  'home-destination-routes',
  () =>
    destinationSpot.value
      ? $fetch<SpotRouteInfo>(
          `/api/spot-routes/${encodeURIComponent(destinationSpot.value.name)}`,
        ).catch(() => null)
      : Promise.resolve(null),
  { watch: [destinationId], default: () => null },
)

/** 목적지로 가는 노선이 지나는 정류장. 승강장 칩을 다시 세우는 데 쓴다. */
const boardingStations = computed(() => new Set(boarding.value?.boardingStations ?? []))

/**
 * 걸어가서 탈 수 있는 목적지행 승강장 — 가까운 다섯 곳에 없을 때의 대안
 *
 * 하나만 고른다. 여럿을 끌어오면 칩 줄이 목적지행으로 덮여 "지금 여기 오는 버스"가
 * 뒤로 밀린다. 목적지는 화면의 전부가 아니다.
 *
 * `radius`가 비면 빈 배열이다 — 그 상태가 곧 "걸어갈 만한 거리에는 없다"이다.
 */
const walkableBoarding = computed<NearbyStation[]>(() =>
  boardingStations.value.size
    ? nearest(
        allStations.value.filter((station) => boardingStations.value.has(station.stationId)),
        coords.value,
        { limit: 1, radius: WALKABLE_M },
      )
    : [],
)

/**
 * 도착정보가 오지 않는 승강장은 뒤로 보낸다 — 그리고 목적지행을 앞으로 당긴다
 *
 * 안동터미널처럼 노선의 기점·종점으로만 쓰이는 승강장에는 "접근 중인 차량"이
 * 성립하지 않아 도착정보가 항상 빈 배열이다(→ ADR-015). 그런 칩이 맨 앞에 오면
 * 첫 화면이 "버스가 없어요"로 열린다. 지우지는 않는다 — 실재하는 승강장이고,
 * 거기 서 있는 사람에게는 "여기는 안 뜬다"는 사실 자체가 답이다.
 *
 * ⚠️ 목적지행도 **거르지 않는다.** 목적지행만 남기면 "표시할 승강장 없음"이 흔한
 *    화면이 된다. 기점 승강장을 지우지 않기로 한 것과 같은 이유다.
 *
 * ⚠️ 가까운 다섯 곳에 목적지행이 하나도 없으면 **여섯 번째 밖에서 끌어온다.**
 *    이게 이 기능에서 값이 가장 큰 한 줄이다. 도착 목록만 다뤄서는 "이 정류장엔
 *    없다"까지만 말하고 어디로 가야 하는지는 끝내 말하지 못한다. 200m 더 걸어야
 *    탈 수 있는 곳이라면 그게 답이다.
 *
 * ⚠️ **끌어오되 도보권까지만.** 처음엔 거리 제한 없이 가장 가까운 목적지행 승강장을
 *    끌어왔다. 실측(2026-09-16)에서 안동대 → 하회마을은 6.1km(도보 91분),
 *    도산서원 → 병산서원은 **20.8km(도보 311분)** 짜리 승강장이 1순위 칩으로
 *    올라왔다. 그건 안내가 아니다. 도보권 밖이면 끌어오지 않고 문구로 말한다
 *    (`destinationTooFar`). → ADR-050
 */
const stations = computed<NearbyStation[]>(() => {
  const near = nearest(allStations.value, coords.value, { limit: 5 })
  const ordered = [...near.filter((s) => !s.terminusOnly), ...near.filter((s) => s.terminusOnly)]

  const reach = boardingStations.value
  if (!reach.size) return ordered

  const list = ordered.some((station) => reach.has(station.stationId))
    ? ordered
    : [...walkableBoarding.value, ...ordered]

  return [
    ...list.filter((station) => reach.has(station.stationId)),
    ...list.filter((station) => !reach.has(station.stationId)),
  ]
})

/**
 * 같은 이름의 정류장이 방향별로 여러 개 있다.
 * 실측: "안동역(안동터미널)"이 stationId 354000416 / 354000459 / 354000536으로 셋이다.
 * 가장 가까운 승강장이 내가 갈 방향이라는 보장이 없으므로 전환할 수 있어야 한다.
 */
const selectedId = ref<number | null>(null)
const activeStation = computed(
  () => stations.value.find((s) => s.stationId === selectedId.value) ?? stations.value[0],
)

/**
 * 승강장을 가르는 한 줄 — 이름이 같은 셋을 여기서 구분한다
 *
 * 카카오·네이버가 "노하동입구 방면"으로 가르는 그 정보다.
 * 같은 이름 셋을 그냥 늘어놓으면 여행자는 어느 것도 고를 수 없다.
 */
function stationTag(station: NearbyStation): string {
  if (station.terminusOnly) return t.value.home.terminusTag
  // 방면은 다음 정류장의 국문 이름이다. 그 이름에 영문 상대가 없다. → ADR-030
  return station.direction ? t.value.home.directionTag(station.direction) : ''
}

/** 30m 안쪽이면 "바로 앞"으로 끝낸다. "바로 앞 · 걸어서 약 1분"은 같은 말을 두 번 한다. */
const stationSubtitle = computed(() => {
  const station = activeStation.value
  if (!station) return undefined

  const near =
    station.distance < 30
      ? t.value.home.rightHere
      : t.value.home.walkFromHere(
          formatDistance(station.distance, d.locale.value),
          station.walkMinutes,
        )

  const tag = stationTag(station)
  return tag ? `${tag} · ${near}` : near
})

const {
  data: arrivals,
  pending: arrivalsPending,
  error: arrivalsError,
  refresh: refreshArrivals,
} = await useFetch<ArrivalWithSpots[]>('/api/bus/arrivals', {
  query: computed(() => ({ stationId: activeStation.value?.stationId })),
  default: () => [],
})

/**
 * 이 차를 타면 목적지에 닿는가
 *
 * ⚠️ **노선이 같기만 해서는 안 된다.** 내 정류장이 목적지보다 뒤면 그 차는 이미
 *    지나쳤고, 거기 태우면 반대 방향으로 보낸다. 순번을 비교한다.
 *    안동은 방향별로 routeId가 다르므로(ADR-007) 이 비교 하나로 방향까지 갈린다.
 *    → `server/utils/boardingDirection.ts` · `scripts/check-boarding.ts`
 */
function goesToDestination(arrival: ArrivalWithSpots): boolean {
  return Boolean(
    boarding.value?.routes.some(
      (option) => option.routeId === arrival.routeId && arrival.stationOrd < option.destOrd,
    ),
  )
}

/**
 * 카드에 넘길 도착 목록 — 목적지행을 앞으로, **거르지는 않고**
 *
 * 안동 외곽 노선은 배차가 하루 3~13회다. 목적지행만 남기면 "표시할 버스 없음"이
 * 기본 화면이 된다. 지금 오는 차가 무엇인지는 그것대로 알아야 하므로 순서만 바꾼다.
 *
 * 각 묶음 안에서는 원래 순서(도착 임박순)가 그대로다. `filter`가 순서를 지킨다.
 */
const arrivalsForPanel = computed<ArrivalForDestination[]>(() => {
  if (!boarding.value) return arrivals.value

  const marked = arrivals.value.map((arrival) => ({
    ...arrival,
    toDestination: goesToDestination(arrival),
  }))

  return [...marked.filter((a) => a.toDestination), ...marked.filter((a) => !a.toDestination)]
})

/**
 * 지금 출발하면 총 몇 분 — 기다리기 + 타고 가기 + 내려서 걷기
 *
 * `busMinutes` 주석이 못박아 둔 조합이다: *"기다리는 시간은 빠져 있다. … 이 값만
 * 단독으로 쓰면 안 된다."* 배차가 하루 3~13회인 안동에서 **대기가 이동보다 긴 경우가
 * 흔하므로**, 이동 시간만 말하면 여행 계획이 통째로 틀어진다.
 *
 * 세 조각의 근거가 서로 다르다. 그래서 화면에도 쪼개서 적는다 —
 * 합계만 보여주면 어디까지가 실측이고 어디부터가 추정인지 알 수 없다.
 *
 *   기다리기  상류가 준 도착 예정 시간(`predictTm`). **잰 값이다.**
 *   타고 가기 승차 정류장 ↔ **하차 정류장** 직선거리 추정. 5분 단위. → `busMinutes`
 *   걷기      하차 정류장 → 목적지 직선거리 추정. → `walkMinutes`
 *
 * ⚠️ 타는 구간을 목적지까지로 재면 마지막 구간이 **걷기와 겹쳐 두 번 세어진다.**
 *    그래서 `/api/spot-boarding`이 하차 정류장 id를 함께 준다.
 *
 * ⚠️ 목적지행 차가 실제로 오고 있을 때만 값이 있다. 오지 않으면 기다리는 시간을
 *    알 수 없고, 그걸 배차 간격으로 지어내면 이 화면의 다른 문장들과 어긋난다.
 */
const trip = computed(() => {
  const arrival = arrivalsForPanel.value.find(
    (candidate) => candidate.toDestination && candidate.predictTm !== null,
  )
  const station = activeStation.value
  const option = boarding.value?.routes.find((route) => route.routeId === arrival?.routeId)
  if (!arrival || !station || !option) return null

  const alight = allStations.value.find((candidate) => candidate.stationId === option.stationId)
  if (!alight) return null

  const wait = arrival.predictTm!
  const ride = busMinutes(distanceMeters(station.lat, station.lng, alight.lat, alight.lng))
  /**
   * 목적지가 정류장이면 내려서 걸을 거리가 없다(`walkMeters === 0`).
   * `walkMinutes`는 바닥이 1분이라 그대로 쓰면 없는 1분이 붙는다.
   */
  const walk = option.walkMeters > 0 ? walkMinutes(option.walkMeters) : 0

  return { wait, ride, walk, total: wait + ride + walk }
})

/**
 * 목적지는 정했는데 이 승강장에는 그리로 가는 노선이 서지 않는 상태
 *
 * 도착이 없는 것과 다르다. 여기는 아무리 기다려도 안 온다는 뜻이므로 다른
 * 승강장으로 보내야 한다. 칩은 이미 목적지행이 앞에 오도록 정렬돼 있다.
 */
const destinationElsewhere = computed(
  () =>
    Boolean(destinationName.value) &&
    boardingStations.value.size > 0 &&
    Boolean(activeStation.value) &&
    !boardingStations.value.has(activeStation.value!.stationId),
)

/** 목적지까지 한 번에 가는 노선이 아예 없는 상태. 환승은 아직 계산하지 않는다. */
const destinationUnreachable = computed(
  () => Boolean(destinationName.value) && boarding.value?.routes.length === 0,
)

/**
 * 목적지행 승강장은 있는데 **전부 도보권 밖**인 상태
 *
 * "이 승강장에는 안 서요, 다른 데를 고르세요"와 다르다. 고를 다른 데가 화면에
 * 없기 때문이다. 도보 91분짜리 칩을 끌어와 있는 척하지 않고 사실을 적는다.
 *
 * ⚠️ "시내에서 타세요"라고 쓰지 않는다. 그럴듯하지만 **44곳 중 4곳에서 거짓**이다
 *    (고산정·농암종택·한국문화테마파크·안동국제컨벤션센터는 시내 승강장에서 탈 수
 *    없다, 실측 2026-09-16). 언제나 참인 것만 적는다.
 */
const destinationTooFar = computed(
  () =>
    Boolean(destinationName.value) &&
    boardingStations.value.size > 0 &&
    walkableBoarding.value.length === 0 &&
    !stations.value.some((station) => boardingStations.value.has(station.stationId)),
)

/**
 * 도착 정보를 마지막으로 받은 시각
 *
 * SSR에서는 만들지 않는다. 서버 시각으로 "방금"을 찍으면 하이드레이션이 어긋난다.
 * 정류장을 바꿔도 다시 받으므로 `arrivals`를 지켜본다.
 */
const updatedAt = ref<number | null>(null)
onMounted(() => (updatedAt.value = Date.now()))
watch(arrivals, () => (updatedAt.value = Date.now()))

async function refreshNow() {
  await refreshArrivals()
  updatedAt.value = Date.now()
}

/** 여기서 끊지 않고 카카오맵까지 잇는다. 승강장이 셋이라 좌표로 넘겨야 정확하다. */
const stationDirectionsUrl = computed(() =>
  activeStation.value
    ? kakaoDirectionsUrl(
        activeStation.value.stationNm,
        activeStation.value.lat,
        activeStation.value.lng,
      )
    : undefined,
)

/**
 * 반경을 넓게 잡아 한 번만 고르고 화면에서 나눈다.
 * 안동역 반경 2km 안에는 관광지가 2곳뿐이라, 도보권만 보여주면 띠가 비어 버린다.
 */
const nearbySpots = computed(() =>
  nearest(spots.value, coords.value, { radius: 30_000, limit: 12 }),
)

const walkable = computed(() => nearbySpots.value.filter((s) => s.distance <= WALKABLE_M))
const rideable = computed(() =>
  nearbySpots.value.filter((s) => s.distance > WALKABLE_M).slice(0, 6),
)

/**
 * 지도의 두 모드 — 걸어서 / 버스로
 *
 * 한 지도에 둘을 겹치지 않는다. 도보권은 반경 2km이고 버스로 갈 곳은 30km까지
 * 흩어져 있어서, 다 담으려면 지도가 안동시 전체로 물러난다. 그러면 이 지도의 본래
 * 일 — "83m 떨어진 저 승강장이 길 건너인가"를 눈으로 가르는 것 — 이 먼저 죽는다.
 * 대신 무엇을 보고 있는지 캡션 옆에서 바꾼다.
 *
 * 두 모드 모두 반경 원과 "나"는 남는다. 버스 모드에서 원은 작게 찍히는데,
 * 그 작음 자체가 "걸어서는 여기까지"라는 뜻이라 지우지 않는다.
 */
const mapMode = ref<'walk' | 'ride'>('walk')

/**
 * 걸어서 — 걸어갈 곳과 서야 할 승강장을 함께 찍는다
 *
 * 승강장을 빼놓으면 이름이 같은 셋을 글자로만 갈라야 한다. "83m 떨어진 다른 승강장"이
 * 길 건너인지 같은 쪽인지는 점 세 개를 보면 한 번에 끝난다.
 */
const walkMarkers = computed(() => [
  // 지도 위 이름은 국문 그대로다. 배경 지도(카카오맵)가 국문이라 여기만 영문을
  // 인쇄하면 지도에 적힌 지명과 어긋나 오히려 못 찾는다. → MapCard
  ...walkable.value.map((spot) => ({ lat: spot.lat, lng: spot.lng, name: spot.name })),
  ...stations.value.map((station) => ({
    lat: station.lat,
    lng: station.lng,
    name: station.stationNm,
    // 상시 이름표(고른 승강장)와 눌렀을 때 뜨는 문구가 이걸 함께 쓴다.
    // 이름은 셋이 같으므로 방면이 있어야 어느 승강장인지 갈린다.
    note: stationTag(station),
    kind: 'stop' as const,
    active: station.stationId === activeStation.value?.stationId,
  })),
])

/**
 * 버스로 — 아래 목록과 **같은 여섯 곳**이다
 *
 * 지도와 목록이 다른 말을 하면 둘 다 못 믿는다. `rideable`을 그대로 쓴다.
 *
 * 이름표는 인쇄하지 않는다(`print-names`). 여섯 곳이 시내 쪽으로 뭉쳐서 인쇄하면
 * 이름이 서로를 덮는다. 대신 누르면 "송강미술관 · 버스로 약 15분"이 뜬다 — `note`가
 * 그 문구를 만든다. 정류장은 아예 찍지 않는다. 이 축척에서 다섯 점은 한 덩어리다.
 */
const rideMarkers = computed(() =>
  rideable.value.map((spot) => ({
    lat: spot.lat,
    lng: spot.lng,
    name: spot.name,
    note: t.value.card.busRideMinutes(busMinutes(spot.distance)),
  })),
)

const mapMarkers = computed(() => (mapMode.value === 'ride' ? rideMarkers.value : walkMarkers.value))

const mapCaption = computed(() =>
  mapMode.value === 'ride'
    ? t.value.home.mapCaptionRide(placeLabel.value, rideable.value.length)
    : t.value.home.mapCaption(placeLabel.value, stations.value.length, walkable.value.length),
)

/** 인기 목록은 상류가 준 순위순 그대로다. nearest()는 사본을 정렬하므로 이 순서를 건드리지 않는다. */
const top = computed(() => spots.value.slice(0, 5))

/**
 * 도착 정보는 30초마다 다시 부른다. 이 화면에서 유일하게 초 단위로 늙는 값이다.
 * 탭이 백그라운드일 때까지 부를 이유는 없다.
 */
onMounted(() => {
  locate()

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshNow()
  }, 30_000)

  onUnmounted(() => clearInterval(timer))
})
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0">
        <div class="py-6 pb-4">
          <h1 class="font-serif text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            {{ heading }}
          </h1>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            {{ t.home.sub }}
          </p>
          <!--
            위치를 못 잡았을 때 이유만 적어 두면 막다른 길이다. 권한을 나중에 허용해도
            새로고침 말고는 되돌릴 방법이 없었다. 다시 시도를 같은 자리에 둔다.
          -->
          <p v-if="locationReason || locating" class="mt-2 text-[13px] text-muted">
            <template v-if="locating">{{ t.home.locating }}</template>
            <template v-else>
              {{ locationReason }}
              <button
                type="button"
                class="ml-1 font-medium text-muted underline"
                @click="locate()"
              >
                {{ t.home.relocate }}
              </button>
            </template>
          </p>
        </div>

        <div
          v-if="arrivalsError"
          class="rounded-md border border-hairline bg-surface-soft p-6 text-sm leading-relaxed"
        >
          <b class="font-semibold">{{ t.home.busErrorTitle }}</b><br />
          <span class="text-muted">{{ t.home.busErrorBody }}</span>
          <button
            class="mt-3 rounded-sm border border-ink px-4 py-2 text-sm font-medium"
            @click="refreshArrivals()"
          >
            {{ t.common.retry }}
          </button>
        </div>

        <!--
          목적지 — **검색창 하나가 두 상태를 다 표현한다.**

          비어 있으면 "지금 접근 중인 버스", 차 있으면 "거기로 가는 버스"다. 예전에는
          검색창과 목적지 칩이 자리를 주고받았는데, 그러면 목적지를 정한 순간 검색창이
          사라져서 **다른 곳으로 바꾸려면 먼저 지워야 한다**는 것을 알아내야 했다.

          주소를 만드는 일은 여기서만 한다. `?to=`/`?stop=` 계약을 읽는 쪽과 쓰는 쪽이
          한 파일에 있어야 한쪽만 바뀌는 일이 없다. → ADR-054
        -->
        <DestinationSearch
          :spots="spots"
          :stations="allStations"
          :coords="coords"
          :destination-name="destinationName"
          :clear-to="localePath('/')"
          @select="
            navigateTo({
              path: localePath('/'),
              query: 'to' in $event ? { to: $event.to } : { stop: $event.stop },
            })
          "
        />

        <!--
          한 번에 가는 노선이 아예 없는 경우. "갈 수 없다"가 아니라 "직행이 없다"이다 —
          환승은 아직 계산하지 않으므로 그 차이를 문구가 지켜야 한다.
        -->
        <p
          v-if="destinationUnreachable && destinationName"
          class="mb-3 rounded-md border border-hairline bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-muted"
        >
          {{ t.home.destinationNoRoute(destinationName) }}
        </p>

        <!-- 노선은 있는데 걸어가서 탈 수 있는 승강장이 없다. 고를 다른 칩이 화면에 없다. -->
        <p
          v-else-if="destinationTooFar && destinationName"
          class="mb-3 rounded-md border border-hairline bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-muted"
        >
          {{ t.home.destinationTooFar(destinationName) }}
        </p>

        <!-- 이 승강장에는 안 서지만 다른 승강장에는 선다. 칩이 이미 그 순서로 서 있다. -->
        <p
          v-else-if="destinationElsewhere && destinationName"
          class="mb-3 rounded-md border border-hairline bg-surface-soft px-4 py-3 text-[13px] leading-relaxed text-muted"
        >
          {{ t.home.destinationOtherStop(destinationName) }}
        </p>

        <!--
          ⚠️ 위의 두 안내는 카드를 **대신하지 않는다.** `v-else-if`로 묶었다가
             안내가 뜨는 순간 도착 카드가 통째로 사라졌다. 목적지행이 없다는 것과
             지금 오는 차가 없다는 것은 다른 사실이고, 뒤엣것은 그것대로 알아야 한다.
        -->
        <BusPanel
          v-if="activeStation && !arrivalsError"
          :station-nm="activeStation.stationNm"
          :station-nm-en="activeStation.nameEn"
          :subtitle="stationSubtitle"
          :arrivals="arrivalsForPanel"
          :destination="destinationName ?? undefined"
          :trip="trip"
          :pending="arrivalsPending"
          :terminus-only="activeStation.terminusOnly"
          :updated-at="updatedAt"
          :directions-url="stationDirectionsUrl"
          @refresh="refreshNow()"
        />

        <!--
          정류장 전환. 방향이 다른 승강장을 고르는 유일한 수단이다.

          줄바꿈이 아니라 가로 스크롤이다. 최대 5개인데 이름이 길어
          ("안동역(안동터미널) 120m") 폰에서 접히면 세 줄까지 늘어나고,
          그만큼 본체인 도착 카드가 화면 밖으로 밀린다. 세로는 아껴야 하는
          자원이고 가로는 남는다. 넓은 화면에서는 대개 다 들어가 스크롤이 안 생긴다.
        -->
        <div v-if="stations.length > 1" class="mt-3 flex gap-2 overflow-x-auto">
          <button
            v-for="station in stations"
            :key="station.stationId"
            class="flex-none rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors"
            :class="[
              station.stationId === activeStation?.stationId
                ? 'border-ink bg-ink text-white'
                : 'border-hairline text-body hover:bg-surface-soft',
              // 도착이 안 뜨는 승강장은 뒤로 밀어 놨다. 눌러볼 수는 있게 두되 앞선 것과 무게를 다르게 준다.
              station.terminusOnly && station.stationId !== activeStation?.stationId
                ? 'opacity-60'
                : '',
            ]"
            @click="selectedId = station.stationId"
          >
            <span class="block whitespace-nowrap">{{ d.stationName(station) }}</span>
            <!--
              방면이 이름을 가른다. 같은 이름 셋을 구분하는 유일한 정보이므로
              칩이 두 줄이 되는 것을 감수한다.
            -->
            <span class="mt-0.5 block whitespace-nowrap text-xs font-normal opacity-70">
              {{
                [stationTag(station), formatDistance(station.distance, d.locale.value)]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </span>
          </button>
        </div>

        <!--
          돌아오는 편 · 막차 — 목적지를 정했을 때만.

          칩 **아래**에 둔다. 읽는 순서가 "몇 분 후"(카드) → "여기서 타면 되나"(칩)
          → "가서 돌아올 수 있나"라서다. 위로 올리면 이 화면의 앵커인 도착 카드가
          그만큼 밀린다. → ADR-012의 정보 순서
        -->
        <DestinationSchedule
          v-if="destinationName"
          :schedule="destinationBus?.schedule ?? null"
          :outbound="destinationRoutes?.outbound"
        />

        <!--
          지도는 정류장 칩 바로 아래다. 고르는 것(칩)과 보는 것(점)이 붙어 있어야
          "83m 떨어진 다른 승강장"이 길 건너인지 같은 쪽인지가 한눈에 온다.

          도보권 관광지 섹션 안에 두었더니 그 목록이 비는 위치에서는 지도까지 통째로
          사라졌다. 정류장은 어디서든 있어야 하므로 밖으로 꺼냈다.

          반경 원은 "버스로"에서만 그린다. 걸어서 모드는 동네 크기로 확대되는데,
          그 축척에서 반경 2km 원은 화면보다 커서 호가 안 보이고 분홍색만 깔린다.
          "걸어갈 수 있는 범위"라는 뜻은 걸어서 모드에서는 캡션이 대신 말한다.
        -->
        <MapCard
          class="mt-4"
          height="220px"
          :center="coords"
          :me="me"
          :radius-m="mapMode === 'ride' ? WALKABLE_M : undefined"
          :markers="mapMarkers"
          :caption="mapCaption"
          :print-names="mapMode === 'walk'"
        >
          <!--
            버스로 갈 곳이 없으면 전환할 것도 없다. 안동 밖에서 접속하면 폴백이
            안동역이라 늘 채워지지만, 반경 30km 안이 비는 경우까지 버튼을 남겨 두면
            눌러도 아무 일도 일어나지 않는 버튼이 된다.
          -->
          <template v-if="rideable.length" #action>
            <div class="flex flex-none gap-1 rounded-full bg-surface-soft p-0.5">
              <button
                v-for="mode in (['walk', 'ride'] as const)"
                :key="mode"
                type="button"
                class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                :class="
                  mapMode === mode ? 'bg-ink text-white' : 'text-muted hover:text-body'
                "
                @click="mapMode = mode"
              >
                {{ mode === 'walk' ? t.home.mapTabWalk : t.home.mapTabRide }}
              </button>
            </div>
          </template>
        </MapCard>

        <section v-if="walkable.length" class="mt-8">
          <div class="mb-4">
            <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
              {{ t.home.walkableHeadLead
              }}<em class="not-italic text-primary">{{ t.home.walkableHeadEmphasis }}</em>
            </h2>
            <p class="mt-1 text-sm text-muted">{{ t.home.walkableSub }}</p>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3">
            <SpotCard v-for="spot in walkable" :key="spot.id" :spot="spot" />
          </div>
        </section>

        <section v-if="rideable.length" class="mt-8 pb-12">
          <div class="mb-4">
            <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
              {{ t.home.rideableHead }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ t.home.rideableSub }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3">
            <SpotCard v-for="spot in rideable" :key="spot.id" :spot="spot" />
          </div>
        </section>
      </div>

      <aside
        class="mt-8 min-w-0 pb-12 desktop:mt-0 desktop:sticky desktop:top-[96px]"
      >
        <div class="mb-4">
          <h2 class="font-serif text-[22px] font-semibold leading-tight tracking-[-0.44px]">
            {{ t.home.popularHead }}
          </h2>
          <p class="mt-1 text-sm text-muted">{{ t.home.popularSub }}</p>
        </div>

        <div class="flex flex-col">
          <NuxtLink
            v-for="spot in top"
            :key="spot.id"
            :to="localePath(`/spots/${spot.id}`)"
            class="flex w-full items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0"
          >
            <span class="w-[22px] flex-none text-center text-base font-semibold text-muted-soft">
              {{ spot.rank }}
            </span>
            <span class="block h-14 w-14 flex-none overflow-hidden rounded-sm">
              <SpotPhoto :src="spot.imageUrl" :alt="d.name(spot)" />
            </span>
            <span class="min-w-0 flex-1">
              <b class="block truncate text-base font-medium leading-tight">{{ d.name(spot) }}</b>
              <span class="mt-0.5 block truncate text-sm text-muted">
                {{ d.category(spot.category) }}
              </span>
            </span>
          </NuxtLink>
        </div>

        <NuxtLink
          :to="localePath('/browse')"
          class="mt-4 inline-block text-base font-medium underline"
        >
          {{ t.home.seeAll }}
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
