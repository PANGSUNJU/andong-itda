import fs from 'node:fs'
const path = 'app/i18n/messages.ts'
let s = fs.readFileSync(path, 'utf8')
const crlf = s.includes('\r\n')
const nl = (x) => (crlf ? x.replace(/\r?\n/g, '\r\n') : x.replace(/\r\n/g, '\n'))
function rep(from, to) {
  const f = nl(from)
  if (!s.includes(f)) throw new Error('not found: ' + from.slice(0, 90))
  s = s.replace(f, nl(to))
}

rep(
`    noticeConstruction: '낙강물길공원은 2028년까지 공사 중이라 코스에서 뺐어요.',`,
`    /**
     * 걸어서 이어지는 동네 — 좌표가 지지하는 묶음
     *
     * ⚠️ 위의 코스 2개와 **다른 것**이라는 사실이 문구에서 읽혀야 한다.
     *    저쪽은 순서와 소요 시간을 말하고 이쪽은 안 한다. 그 차이를 숨기면
     *    "왜 어떤 건 순서가 있고 어떤 건 없나"가 결함으로 읽힌다. → ADR-043
     */
    areasHead: '걸어서 이어지는 동네',
    areasSub: '관광지와 문화시설 133곳의 좌표를 이어, 걸어서 오갈 수 있는 묶음을 찾았어요',
    /** "16곳 · 최대 폭 2.7km" — 폭이 크면 한 번에 도는 곳이 아니라는 뜻이다 */
    areaSummary: (count: number, span: string) => `${count}곳 · 최대 폭 ${span}`,
    areaStation: (station: string, distance: string, minutes: number) =>
      `${station}에서 ${distance} · 걸어서 약 ${minutes}분`,
    areaMore: (count: number) => `외 ${count}곳`,
    areasMapCaption: (count: number) => `걸어서 이어지는 동네 ${count}곳`,
    /** 근거를 밝힌다. 순서를 정하지 않았다는 것이 이 한 줄의 핵심이다. */
    areasNote:
      '좌표로 이어 본 묶음이에요. 순서와 소요 시간은 정하지 않았어요 — 실제 보행로는 직선거리와 달라요.',

    noticeConstruction: '낙강물길공원은 2028년까지 공사 중이라 코스에서 뺐어요.',`,
)

rep(
`    noticeConstruction:
      'Nakgang Water Trail Park is under construction until 2028, so we left it out.',`,
`    areasHead: 'Neighbourhoods you can walk',
    areasSub:
      'We linked the coordinates of 133 attractions and cultural venues to find clusters you can cover on foot',
    areaSummary: (count: number, span: string) => `${count} places · up to ${span} across`,
    areaStation: (station: string, distance: string, minutes: number) =>
      `${distance} from ${station} · about ${minutes} min walk`,
    areaMore: (count: number) => `+${count} more`,
    areasMapCaption: (count: number) => `${count} walkable neighbourhoods`,
    areasNote:
      'These clusters come from coordinates. We did not set an order or a duration — real footpaths differ from straight lines.',

    noticeConstruction:
      'Nakgang Water Trail Park is under construction until 2028, so we left it out.',`,
)

fs.writeFileSync(path, s)
console.log('patched', path)
