/**
 * 페이지 제목 — 탭과 공유 카드가 같은 문장을 쓴다
 *
 * `useHead({ title })`만 부르면 `<title>`은 맞지만 `og:title`이 빈다. 스크래퍼
 * 대부분이 `<title>`로 폴백하기는 한다. 다만 링크가 붙여넣기는 자리가
 * 카카오톡·슬랙·트위터·디스코드로 갈리고 폴백 규칙이 서로 조금씩 다르므로,
 * "대개 된다"에 기대지 않고 명시한다.
 *
 * 제목을 정하는 자리를 하나로 둔다. 페이지는 문장 하나만 넘긴다. 나머지 공유
 * 메타(설명·이미지·주소·언어)는 셸이 한 번만 붙인다. → `layouts/default.vue`
 *
 * ⚠️ 함수를 받는다. 언어가 주소에서 오므로 제목도 언어를 따라 바뀌어야 하고,
 *    값으로 받으면 첫 렌더의 언어에 굳는다.
 */
export function usePageTitle(title: () => string) {
  useHead(() => ({
    title: title(),
    meta: [
      { property: 'og:title', content: title() },
      { name: 'twitter:title', content: title() },
    ],
  }))
}
