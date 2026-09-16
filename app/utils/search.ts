/**
 * 이름으로 찾기 — 홈의 목적지 검색과 둘러보기가 함께 쓴다
 *
 * ⚠️ **의존이 없다.** `scripts/check-search.ts`가 node로 직접 부른다.
 *    `format.ts`가 같은 이유로 상대경로 import만 쓰는 것과 같다.
 *
 * 이 파일이 있는 이유는 ADR-052다. 홈에 검색을 달았다가 **엉뚱한 결과** 때문에
 * 걷어냈고, 그때 다시 붙일 조건을 세 가지 적어 두었다. 아래 규칙이 그 명세다.
 */

/**
 * 조합 중인 낱자를 떼어낸다.
 *
 * 한글 IME는 음절이 끝나기 전까지 낱자(`ㅎ`)를 입력값에 그대로 넣는다. 그대로
 * 검색하면 "하회"를 치는 도중 `하ㅎ`가 되어 **결과가 0곳으로 깜빡인다.** 떼어내면
 * "하회" → "하회마"로 자연스럽게 좁혀진다.
 *
 * ⚠️ 낱자만 친 상태(`"ㅎ"`)는 빈 검색어가 된다. 초성 검색은 하지 않는다 —
 *    그건 다른 기능이고, 여기서 흉내 내면 "ㅎ"에 엉뚱한 곳이 쏟아진다. → ADR-052
 *
 * 범위는 한글 호환 자모(U+3131~U+318E)다. IME가 낱자로 보여주는 것이 이 블록이다.
 */
export const TRAILING_JAMO = /[ㄱ-ㆎ]+$/

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(TRAILING_JAMO, '')
}

/** 대소문자와 공백만 무시한다. **괄호는 남긴다** — 아래 `CITY_PREFIX` 주석 참고. */
function fold(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

/**
 * 시군 접두어. LocgoHub가 관광지 이름 앞에 붙인다(`안동하회마을`).
 *
 * `(?=.)`가 있어야 `"안동"`이라는 이름 자체가 빈 문자열이 되지 않는다.
 */
const CITY_PREFIX = /^(안동|andong)(?=.)/i

/**
 * 이 라벨이 검색어에 얼마나 잘 맞는가. 작을수록 잘 맞는다. `-1`은 안 맞는다.
 *
 *    0  이름이 검색어로 시작한다 (시군 접두어를 떼고 시작하는 것도 포함)
 *    1  이름 **안에** 검색어가 들어 있다
 *
 * ⚠️ **라벨은 문자열로 받는다.** 객체를 받아 속마음까지 뒤지면 화면에 안 보이는
 *    필드로 결과가 걸린다. 부르는 쪽이 이미 화면에 찍을 글자를 만들어 넘기므로,
 *    *"검색은 화면에 보이는 글자로 찾는다"*(→ ADR-051)가 타입으로 강제된다.
 *
 * ⚠️ **`cityPrefix`는 관광지에만 켠다.** 정류장 이름에서 `안동`은 데이터
 *    아티팩트가 아니라 **고유명사의 일부**다(`안동병원`·`안동초등학교`·`안동역`).
 *    정류장에 켜고 실측한 결과(2026-09-17):
 *
 *        "병원"    시작 1곳(안동병원)만 남고 성소병원앞 등 **7곳이 숨는다**
 *        "초등학교" 시작 1곳만 남고 용상·영가초등학교 등 **8곳이 숨는다**
 *
 *    ADR-052가 지목한 `"도산"` → `경상북도산림과학박물관`과 **똑같은 실패 모양**이다.
 *    방향만 반대다. 시작 티어가 엉뚱하게 차면 나머지가 통째로 억제된다.
 */
export function nameRank(label: string, query: string, cityPrefix = false): number {
  const name = fold(label)
  const needle = fold(query)
  if (!needle) return -1
  if (name.startsWith(needle)) return 0
  // 접두어를 뗀 시작도 같은 티어다. 한 단계 아래로 내리면 "하회"에서
  // `하회세계탈박물관`(원본 시작)이 티어를 채워 **`안동하회마을`이 숨는다.**
  if (cityPrefix && name.replace(CITY_PREFIX, '').startsWith(needle)) return 0
  if (name.includes(needle)) return 1
  return -1
}

/**
 * 시작 일치가 하나라도 있으면 **그것만** 내놓고, 없을 때만 포함 일치로 내려간다.
 *
 * 이 코드베이스가 이미 두 번 쓴 모양이다 — 둘러보기의 "이름 먼저, 없으면 주소",
 * 그리고 홈의 "관광지 먼저, 없으면 정류장". 같은 폴백을 한 단계 더 쓴다.
 *
 * 실측으로 고른 규칙이다(2026-09-17, 관광지 44곳 · 정류장 이름 1,154종):
 *
 *    "도산"  도산서원만. `경상북도산림과학박물관`은 포함 티어라 가려진다  ← ADR-052 1번 증상
 *    "박물관" 4곳. `경상북도산림과학박물관`이 **여기선 남는다**
 *
 * 우연한 부분 문자열과 정당한 부분 문자열이 이 한 줄로 갈린다.
 *
 * ⚠️ 치르는 값도 있다. `"문화"`는 `안동문화예술의전당`(접두어 뗀 시작)이 티어를
 *    채워 `한국문화테마파크`가 가려진다. `하회` 두 곳을 살리는 대가로 받았다 —
 *    하회마을은 안동에서 가장 많이 찾는 목적지다.
 */
export function rankedMatches<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  query: string,
  cityPrefix = false,
): T[] {
  const ranked: { rank: number; item: T }[] = []
  for (const item of items) {
    const rank = nameRank(labelOf(item), query, cityPrefix)
    if (rank >= 0) ranked.push({ rank, item })
  }
  const starts = ranked.filter((entry) => entry.rank === 0)
  return (starts.length ? starts : ranked).map((entry) => entry.item)
}
