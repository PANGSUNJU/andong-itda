import type { StationPin } from '#shared/types/bus'
import type { Spot, WalkArea, WalkPlace } from '#shared/types/tour'
import { distanceMeters, walkMinutes } from '#shared/constants/location'

/**
 * 걸어서 이어지는 동네 — 좌표가 지지하는 묶음
 *
 * 손으로 짠 코스 2개(`app/data/courses.ts`)와 나란히 서는 자리다. 저쪽은 순서와
 * 소요 시간을 주장하고 이쪽은 안 한다. 근거가 다르므로 화면에서도 갈라 둔다.
 * → ADR-043
 *
 * 재료는 `fetchKorSpots()`가 이미 받아 오는 관광지(12) + 문화시설(14) 133곳이다.
 * 새 상류 호출이 없다 — 같은 조회를 `/api/spots`와 나눠 쓴다.
 *
 * 1일 캐시한다. 관광지 좌표는 달 단위로도 안 바뀐다.
 */
/**
 * 상류 이름에서 꼬리표를 뗀다.
 *
 * "안동 하회마을 [유네스코 세계유산]"처럼 대괄호로 수식이 붙어 온다. 묶음 이름은
 * 짧아야 목록에서 읽히므로 떼어낸다. 지점 목록에는 원래 이름이 그대로 남는다 —
 * 상류가 준 이름을 바꾸는 게 아니라 제목에만 짧은 쪽을 쓰는 것이다.
 */
function areaName(name: string): string {
  // 정규식으로 괄호 쌍을 맞추지 않는다. 여는 괄호부터 잘라내면 충분하고,
  // "개목사(안동)" → "개목사"처럼 덤으로 정리되는 이름도 있다.
  const cut = name.search(/[[(（【]/)
  return (cut > 0 ? name.slice(0, cut) : name).trim() || name
}

const cachedAreas = defineCachedFunction(
  async (): Promise<WalkArea[]> => {
    const [korSpots, stations, spots] = await Promise.all([
      fetchKorSpots(),
      $fetch<StationPin[]>('/api/bus/stations'),
      $fetch<Spot[]>('/api/spots'),
    ])

    const places: WalkPlace[] = korSpots.flatMap((kor) => {
      const lat = Number(kor.mapy)
      const lng = Number(kor.mapx)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return []

      return [
        {
          name: kor.title,
          lat,
          lng,
          ...(kor.firstimage ? { imageUrl: httpsImage(kor.firstimage) } : {}),
        },
      ]
    })

    /**
     * 묶음 이름의 기준 — 안에서 방문 순위가 가장 높은 곳
     *
     * 상류 이름이 조금씩 다르다("안동 임청각" ↔ "안동임청각"). 이미 있는
     * 정규화를 쓴다. 못 찾으면 **첫 지점의 이름**으로 떨어진다.
     *
     * ⚠️ 정류장 이름으로 떨어뜨리지 않는다. 처음에 그렇게 했더니 "주하1 일대"가
     *    나왔다 — 정류장 번호가 붙은 행정 이름이라 여행자가 읽을 이름이 아니다.
     *    그 묶음의 첫 지점은 "안동 주하리 뚝향나무"다. 정류장은 어차피 아래에
     *    따로 적히므로 이름까지 그걸로 할 이유가 없다.
     */
    const ranked = new Map(
      spots
        .filter((spot) => spot.rank !== null)
        .map((spot) => [normalizeSpotName(spot.name), spot] as const),
    )

    const areas = clusterPlaces(places).map((group): WalkArea => {
      const nearest = stations
        .map((station) => ({
          station,
          distance: Math.round(
            Math.min(
              ...group.map((place) =>
                distanceMeters(place.lat, place.lng, station.lat, station.lng),
              ),
            ),
          ),
        }))
        .sort((a, b) => a.distance - b.distance)[0]

      const best = group
        .map((place) => ({ place, spot: ranked.get(normalizeSpotName(place.name)) }))
        .filter((entry) => entry.spot)
        .sort((a, b) => (a.spot!.rank ?? Infinity) - (b.spot!.rank ?? Infinity))[0]

      return {
        id: group[0]!.name,
        anchor: areaName(best?.place.name ?? group[0]!.name),
        // 사진이 있는 곳을 앞에 둔다. 화면이 이름만 늘어놓지 않게 한다.
        places: [...group].sort((a, b) => Number(!!b.imageUrl) - Number(!!a.imageUrl)),
        spanMeters: spanOf(group),
        station:
          nearest === undefined
            ? null
            : {
                stationId: nearest.station.stationId,
                stationNm: nearest.station.stationNm,
                ...(nearest.station.nameEn ? { nameEn: nearest.station.nameEn } : {}),
                distance: nearest.distance,
                walkMinutes: walkMinutes(nearest.distance),
              },
      }
    })

    // 볼거리가 많은 순. 곳 수가 같으면 정류장이 가까운 쪽이 앞이다.
    return areas.sort(
      (a, b) =>
        b.places.length - a.places.length ||
        (a.station?.distance ?? Infinity) - (b.station?.distance ?? Infinity),
    )
  },
  {
    maxAge: 60 * 60 * 24, // 1일
    name: 'walk-areas',
    getKey: () => 'all',
  },
)

export default defineEventHandler(async (): Promise<WalkArea[]> => cachedAreas())
