import type { Locale } from '~/i18n/messages'

/**
 * 걷는 길 — 자체 큐레이션 코스
 *
 * 공공 API에 없는 데이터다. 두루누비 API의 안동 코스 존재 여부가 아직
 * 확인되지 않았고, TourAPI 여행코스(contentTypeId=25)는 차량 이동을 전제한다.
 * 그래서 "버스 없이 걸어서 이어지는 길"은 직접 만든다.
 *
 * 소요 시간은 직선거리가 아니라 실제 보행로 기준의 추정치다.
 * 낙강물길공원은 2028년까지 공사 중이라 제외했다. → ADR-008
 *
 * ⚠️ 이 화면만 두 언어를 **데이터에** 담는다. 다른 화면의 문장은 우리 것이라
 *    `i18n/messages.ts`에 있고, 이름·주소는 상류 것이라 번역하지 않는다.
 *    여기는 문장도 우리 것인데 데이터 모양을 하고 있어 사전에 넣으면
 *    코스를 하나 더 짤 때마다 사전과 데이터 두 곳을 고쳐야 한다.
 */

/** 두 언어의 같은 문장. 한쪽을 빼면 컴파일에서 걸린다. */
type Text = Record<Locale, string>

export interface CourseStep {
  /**
   * ⚠️ 지명은 **국문 그대로**다. 영문 화면에서도 마찬가지다.
   *
   *    임청각·칠층전탑의 공식 영문명을 우리가 확인하지 못했고, 확인하지 못한
   *    이름을 로마자로 지어내면 여행자가 그 이름을 들고 아무에게도 길을 물을 수
   *    없다. 현장 표지판이 국문이므로 국문이 오히려 쓸모 있다. → ADR-030
   */
  name: string
  detail: Text
}

export interface Course {
  id: string
  title: Text
  /**
   * 코스가 시작·끝나는 **관광지 이름**.
   *
   * `/api/spot-routes`가 이 이름으로 노선을 찾는다(→ ADR-036의 노선 안내). 그래서
   * `/api/spots` 목록에 실제로 있는 이름이어야 한다. 없으면 화면이 버스 줄을
   * 그리지 않을 뿐 나머지는 그대로 뜬다.
   *
   * `steps[0].name`을 쓰지 않고 따로 두는 이유는, 코스가 관광지가 아닌 곳에서
   * 시작할 수도 있기 때문이다. 그때 이 칸이 비면 "버스를 못 찾았다"가 아니라
   * "여기서는 안 찾는다"가 되어야 한다.
   */
  start: string
  end: string
  /** '낮' | '밤' */
  timeOfDay: Text
  distanceKm: number
  minutes: number
  terrain: Text
  steps: CourseStep[]
  cautions: Text[]
}

export const COURSES: Course[] = [
  {
    id: 'riverside',
    title: { ko: '강변 옛길', en: 'The Old Riverside Way' },
    start: '안동임청각',
    end: '월영교',
    timeOfDay: { ko: '낮', en: 'Daytime' },
    distanceKm: 4.1,
    minutes: 70,
    terrain: { ko: '평지', en: 'Flat' },
    steps: [
      {
        name: '안동임청각',
        detail: { ko: '구 안동역에서 걸어서 14분', en: '14 min walk from the old Andong Station' },
      },
      { name: '법흥사지 칠층전탑', detail: { ko: '걸어서 2분', en: '2 min walk' } },
      { name: '신세동 벽화마을', detail: { ko: '걸어서 9분', en: '9 min walk' } },
      { name: '월영교', detail: { ko: '걸어서 22분', en: '22 min walk' } },
    ],
    cautions: [
      { ko: '그늘이 적어요', en: 'Little shade along the way' },
      { ko: '물을 챙기세요', en: 'Bring water' },
    ],
  },
  {
    id: 'moonlight',
    title: { ko: '달빛 물길', en: 'Moonlight on the Water' },
    start: '안동민속촌',
    end: '월영교',
    timeOfDay: { ko: '밤', en: 'After dark' },
    distanceKm: 1.6,
    minutes: 30,
    terrain: { ko: '야간 조명', en: 'Lit at night' },
    steps: [
      {
        /**
         * ⚠️ 여기 "3번 버스에서 내리면 시작"이라고 적혀 있었다. 안동민속촌에 오는
         *    노선은 **112번**이다(실측 2026-09-10). 손으로 적은 노선 번호가
         *    조용히 틀어져 있었고, 아무도 그걸 검증하지 않았다.
         *
         *    노선 번호는 이제 데이터에 적지 않는다. 아래 "버스로 오가기" 줄이
         *    상류에서 계산해 채운다. 손으로 적으면 또 틀어진다.
         */
        name: '안동민속촌',
        detail: { ko: '여기서 시작해요', en: 'The walk starts here' },
      },
      { name: '월영공원', detail: { ko: '걸어서 7분', en: '7 min walk' } },
      {
        name: '월영교',
        detail: {
          ko: '걸어서 5분 · 해 지면 조명이 켜져요',
          en: '5 min walk · the lights come on after sunset',
        },
      },
    ],
    cautions: [{ ko: '돌아오는 버스를 미리 확인하세요', en: 'Check the bus back before you set out' }],
  },
]
