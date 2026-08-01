/**
 * 걷는 길 — 자체 큐레이션 코스
 *
 * 공공 API에 없는 데이터다. 두루누비 API의 안동 코스 존재 여부가 아직
 * 확인되지 않았고, TourAPI 여행코스(contentTypeId=25)는 차량 이동을 전제한다.
 * 그래서 "버스 없이 걸어서 이어지는 길"은 직접 만든다.
 *
 * 소요 시간은 직선거리가 아니라 실제 보행로 기준의 추정치다.
 * 낙강물길공원은 2028년까지 공사 중이라 제외했다. → ADR-008
 */

export interface CourseStep {
  name: string
  detail: string
}

export interface Course {
  id: string
  title: string
  /** '낮' | '밤' */
  timeOfDay: string
  distanceKm: number
  minutes: number
  terrain: string
  steps: CourseStep[]
  cautions: string[]
}

export const COURSES: Course[] = [
  {
    id: 'riverside',
    title: '강변 옛길',
    timeOfDay: '낮',
    distanceKm: 4.1,
    minutes: 70,
    terrain: '평지',
    steps: [
      { name: '안동임청각', detail: '구 안동역에서 걸어서 14분' },
      { name: '법흥사지 칠층전탑', detail: '걸어서 2분' },
      { name: '신세동 벽화마을', detail: '걸어서 9분' },
      { name: '월영교', detail: '걸어서 22분' },
    ],
    cautions: ['그늘이 적어요', '물을 챙기세요'],
  },
  {
    id: 'moonlight',
    title: '달빛 물길',
    timeOfDay: '밤',
    distanceKm: 1.6,
    minutes: 30,
    terrain: '야간 조명',
    steps: [
      { name: '안동민속촌', detail: '3번 버스에서 내리면 시작' },
      { name: '월영공원', detail: '걸어서 7분' },
      { name: '월영교', detail: '걸어서 5분 · 해 지면 조명이 켜져요' },
    ],
    cautions: ['돌아오는 버스를 미리 확인하세요'],
  },
]
