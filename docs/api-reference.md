# API 레퍼런스

안동잇다에서 사용하는 외부 API 정리.
검증 완료된 것과 미확인인 것을 구분해 표시한다.

---

## 1. 안동시 버스정보 API

- **베이스**: `http://bus.andong.go.kr/m01/s04.do`
- **인증키**: 불필요
- **프로토콜**: http (서버 프록시 필수)

| 기능 | 요청 | 상태 |
|---|---|---|
| 정류장 목록 | `?tab=1` | ✅ 검증 완료 |
| 정류장별 도착정보 | `?i={stationId}&tab=2` | ✅ 검증 완료 |
| 노선 목록 | `?tab=3` | 미확인 |
| 노선별 정류장 | `?i={routeId}&tab=4` | 미확인 |
| 노선별 차량위치 | `?i={routeId}&tab=5` | 미확인 |

### 정류장 목록 응답 (주요 필드)
```json
{
  "stationId": 354000001,
  "stationNm": "길안정류장",
  "stationEngNm": "Gilan Bus Stop",
  "stationChnNm": "吉安站",
  "stationJpnNm": "吉安停留場",
  "gpsX": 128.8911219762,
  "gpsY": 36.4587033576,
  "govCd": "354",
  "useYn": "Y"
}
```
- `useYn === "Y"` 필터링 필요 (폐지 정류장 제외)
- 다국어 정류장명 존재 → 2단계 다국어 지원 시 활용

### 도착정보 응답 (주요 필드)
```json
{
  "routeId": 354300021,
  "routeNum": "212",
  "routeNm": "212(국립경국대-도청)",
  "via": "국립경국대 -> 정부경북지방합동청사",
  "predictTm": 3.0,
  "remainStation": 4,
  "plateNo": "경북70자3443"
}
```

| 필드 | 용도 | 비고 |
|---|---|---|
| `routeNum` | 노선 번호 (화면 주표시) | "212", "순환2-1" |
| `via` | 기점 → 종점 (방향 안내) | 명세서 미기재, 실제 존재 |
| `predictTm` | 도착 예정 (분) | null 가능 → 폴백 필요 |
| `remainStation` | 남은 정류장 수 | 보조 표시 |

- 정렬: `predictTm` 오름차순
- 운행 시간대 외에는 빈 배열 반환
- 외곽 정류장은 배차 간격이 길어 빈 응답이 정상일 수 있음

---

## 2. TourAPI 기초지자체 중심관광지 (LocgoHubTarService1)

- **베이스**: `http://apis.data.go.kr/B551011/LocgoHubTarService1`
- **오퍼레이션**: `areaBasedList1`
- **갱신주기**: 월 1회 (매월 8일)
- **상태**: ✅ 검증 완료

```
http://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1
  ?serviceKey={KEY}
  &numOfRows=100&pageNo=1
  &MobileOS=ETC&MobileApp=AndongItda&_type=json
  &baseYm=202605
  &areaCd=47&signguCd=47170
```

⚠️ `baseYm`(YYYYMM) 필수. 최신 월 데이터가 없으면 이전 월로 폴백 필요.

### 응답 (주요 필드)
```json
{
  "hubTatsCd": "446c3106f3d69d4cef86e1cfe0b876bf",
  "hubTatsNm": "안동하회마을",
  "hubCtgryLclsNm": "관광지",
  "hubCtgryMclsNm": "역사관광",
  "hubRank": "1",
  "mapX": "128.517994889252000",
  "mapY": "36.539062884929000"
}
```

### 안동 상위 관광지
| 순위 | 이름 | 중분류 |
|---|---|---|
| 1 | 안동하회마을 | 역사관광 |
| 2 | 월영교 | 기타관광 |
| 3 | 병산서원 | 역사관광 |
| 4 | 도산서원 | 역사관광 |
| 5 | 봉정사 | 역사관광 |
| 7 | 안동역 | 기타관광 |
| 21 | 안동구시장 | 쇼핑 |
| 30 | 안동임청각 | 역사관광 |
| 61 | 법흥사지칠층전탑 | 역사관광 |

- `hubCtgryLclsNm`: 관광지 / 숙박 → 숙박은 필터링 (약 35건)

---

## 3. TourAPI 국문 관광정보 (KorService2)

- **베이스**: `https://apis.data.go.kr/B551011/KorService2`
- **상태**: ✅ 목록 조회 검증 완료 / 키워드 검색 미해결

### 공통 파라미터
```
serviceKey={KEY}&MobileOS=ETC&MobileApp=AndongItda&_type=json
&numOfRows=100&pageNo=1&areaCode=35&sigunguCode=11
```

| 오퍼레이션 | 용도 | 상태 |
|---|---|---|
| `areaBasedList2` | 지역 기반 목록 | ✅ |
| `locationBasedList2` | 위치 기반 주변 탐색 | 미확인 |
| `detailCommon2` | 상세 공통 정보 | 미확인 |
| `detailIntro2` | 운영시간·입장료 | 미확인 |
| `searchFestival2` | 축제 기간 검색 | 미확인 |
| `searchKeyword2` | 키워드 검색 | ⚠️ 파라미터 오류 (`Keyword` 대문자) |

### contentTypeId
| 코드 | 분류 | 안동 건수 |
|---|---|---|
| 12 | 관광지 | 64 |
| 14 | 문화시설 | 12 |
| 15 | 축제/공연/행사 | 미확인 |
| 25 | 여행코스 | 미확인 |
| 39 | 음식점 | 미확인 |

### 응답 (주요 필드)
```json
{
  "contentid": "126157",
  "contenttypeid": "12",
  "title": "개목사(안동)",
  "addr1": "경상북도 안동시 서후면 개목사길 362",
  "mapx": "128.6679838568",
  "mapy": "36.6579094974",
  "firstimage": "http://tong.visitkorea.or.kr/...jpg"
}
```
- `firstimage` 빈 값 존재 (64건 중 4건) → 폴백 이미지 필요

---

## 4. 지역 코드 대조표

| API | 파라미터명 | 안동시 값 |
|---|---|---|
| KorService2 | `areaCode` / `sigunguCode` | `35` / `11` |
| LocgoHubTarService1 | `areaCd` / `signguCd` | `47` / `47170` |

⚠️ 파라미터 이름과 값이 모두 다르다. 상수로 분리 관리할 것.

---

## 5. 미확인 API

| API | 용도 | 확인 필요 사항 |
|---|---|---|
| 두루누비 정보 서비스 | 도보 코스 | 안동 코스 존재 여부, 필터링 방법 |
| 관광지 집중률 예측 | 방문자 추이 | 엔드포인트, 코드 체계 |
| 관광지별 연관 관광지 | 주변 추천 | 엔드포인트, 파라미터 |

---

## 6. 내부 API 설계안

```
GET /api/spots                    중심관광지 순위 목록 (숙박 제외, 상세 병합)
GET /api/spots/[id]               관광지 상세
GET /api/spots/nearby?lat=&lng=   현 위치 주변 탐색
GET /api/food                     음식점 목록
GET /api/festivals?date=          축제·행사
GET /api/courses                  도보 코스
GET /api/bus/arrivals?stationId=  버스 실시간 도착 (캐시 없음)
GET /api/bus/stations             정류장 목록
```
