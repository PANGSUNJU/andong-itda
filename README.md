# 안동잇다

차 없이 안동에 온 여행자를 위한 웹 서비스.

버스를 기다리는 시간에 다녀올 수 있는 곳을 알려준다.

> 2026 관광데이터 활용 공모전 출품작 (1차 통과)

---

## 이 서비스가 해결하려는 것

안동을 여행하려는 사람은 두 가지 벽에 부딪힌다.

1. **교통에 대한 막연한 불안** — "거기 대중교통으로 갈 수 있을까?"
2. **뭘 할지 모르는 막막함** — "하회마을 말고 뭘 해야 하지?"

핵심 통찰은 하나다. **배차 간격이 길다는 것은 대기 시간이 생긴다는 뜻이고,
그 시간에 주변을 다녀올 수 있다.** 이 문장이 화면 구조의 조직 원리다.

기존 안동 서비스들은 교통과 관광이 분리되어 있어 여행자가 앱을 오가야 했다.
안동잇다는 둘을 한 화면에 둔다.

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Nuxt 4 (TypeScript) |
| 스타일 | Tailwind CSS v4 |
| 패키지 매니저 | pnpm |
| 배포 | Vercel |
| 백엔드 | 없음 (Nuxt server routes) |
| 데이터베이스 | 없음 |

백엔드와 DB를 두지 않은 이유는 [docs/decisions.md](docs/decisions.md) ADR-001에 있다.

---

## 활용 데이터

**한국관광공사 OpenAPI**
- 기초지자체 중심 관광지 정보 (LocgoHubTarService1) — 방문 기반 인기 순위
- 국문 관광정보 서비스 (KorService2) — 설명·이미지·주소

**안동시 공공 API**
- 정류장 정보 / 정류장별 도착정보 / 노선 정보

**안동시 공공데이터**
- 시내버스 운행시간표 (첫차·막차 산출)

---

## 시작하기

```bash
pnpm install
cp .env.example .env   # 실제 키를 채운다
pnpm dev

# 회귀 검증 (프레임워크 없음, node로 바로 실행)
node scripts/check-bus-logic.ts
node scripts/check-spot-match.ts
```

⚠️ 프로젝트 경로에 한글이 포함되면 pnpm의 심볼릭 링크 생성이 실패한다.
영문 경로에 두어야 한다. ([ADR-017](docs/decisions.md))

⚠️ `TOUR_API_KEY`는 data.go.kr의 **Encoding·Decoding 키 어느 쪽을 넣어도 동작한다.**
코드가 한 번 디코딩해 정규화하기 때문이다. 직접 URL을 조립할 때 Encoding 키를
다시 인코딩하면 401이 난다. ([ADR-018](docs/decisions.md))

안동시 버스 API는 인증키가 필요 없다.

---

## 구현 상태

**서버 라우트** (`server/api/`)

| 라우트 | 캐시 | 상태 |
|---|---|---|
| `GET /api/bus/stations` | 1일 | ✅ 2107건 → 4필드 153KB (`useYn='Y'`·중복 `stationId` 제거, 좌표 5자리) |
| `GET /api/bus/arrivals?stationId=` | 없음 | ✅ `predictTm` 오름차순, null 후순위 |
| `GET /api/bus/routes` | 1분 | ✅ 421건 (`runTotCnt` 포함) |
| `GET /api/spot-bus/[spot]` | 없음 | ✅ 실시간 + 시간표 + 운행여부 결합 |
| `GET /api/spots` | 1일 | ✅ 49건 (숙박·노이즈 제외, 이미지 76%) |
| `GET /api/food` | 1일 | ✅ 16건 (찜닭1·헛제삿밥2·한식8·카페5) |
| `GET /api/spots/[id]` | — | 미구현 (`detailCommon2` 미검증) |

**좌표를 받는 라우트는 없다.** 주변 정류장·주변 관광지는 목록을 통째로 받아
브라우저에서 `nearest()`로 고른다. 사용자 좌표를 서버로 보내지 않기 위해서다.
→ [ADR-024](docs/decisions.md)

**화면** (`app/`)

| 경로 | 상태 |
|---|---|
| `/` 지금 여기 | ✅ 위치 기반 정류장·도착·도보권/버스권 관광지·인기 순위 |
| `/browse` 둘러보기 | ✅ 관광지 49곳 검색·분류·정렬 / 식도락 16곳 (분류 → [ADR-023](docs/decisions.md)) |
| `/spots/[id]` 상세 | ✅ 관광 정보 + 버스 안내 한 화면 (등록된 7곳) |
| `/walk` 걷는 길 | ✅ 자체 큐레이션 코스 2개 (정적) |

지도는 `MapCard` 하나가 세 자리(홈 도보 반경 · 둘러보기 분포 · 상세 주변)를 맡는다.
목록 필터를 그대로 따라가고, 스크롤을 먹지 않도록 드래그·줌은 껐다. → [ADR-013](docs/decisions.md)

⚠️ **JavaScript 키가 있어도 도메인을 등록해야 뜬다.** 카카오는 등록되지 않은
출처에 SDK 대신 401(`domain mismatched`)을 준다. **포트까지 본다.**
콘솔 > 앱 설정 > 플랫폼 > Web에 `http://localhost:3000`처럼 실제 접속 주소를 등록할 것.
등록 전에는 지도 자리에 "지도를 불러오지 못했어요"가 뜬다(키가 아예 없으면 "지도 준비 중").

⚠️ `/api/spots`는 캐시가 빈 첫 요청에 **약 11초** 걸린다. 이미지 보충을 위해
TourAPI를 수십 번 호출하기 때문이다. 서버리스 함수 제한을 넘길 수 있으므로
배포 전에 빌드 타임 생성이나 스케줄 워밍으로 옮겨야 한다.

캐시는 `.nuxt/cache/nitro/handlers/`에 파일로 남아 **재빌드해도 살아남는다.**
서버 코드를 고쳤는데 응답이 그대로면 이 파일부터 지울 것.

다음 작업은 [docs/dev-log.md](docs/dev-log.md)의 "다음에 할 일"에 있다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [docs/decisions.md](docs/decisions.md) | 설계 결정 기록 (ADR 25건) |
| [docs/dev-log.md](docs/dev-log.md) | 날짜별 개발 로그 · 다음에 할 일 |
| [docs/api-reference.md](docs/api-reference.md) | 검증된 API 명세 |
| [PROJECT-PROMPT.md](PROJECT-PROMPT.md) | 프로젝트 구축 지시서 (초기 기준, 일부는 실측으로 갱신됨) |

이 프로젝트에서 반복해 확인된 사실은 하나다.
**문서보다 실물이 정확하다.** 공식 명세서에 없던 필드가 실제 응답에는 있었고,
명세서에 있던 필드는 오지 않았다.
