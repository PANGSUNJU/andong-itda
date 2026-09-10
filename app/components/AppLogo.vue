<!--
  심볼 — 앞서 걷는 발자국 둘

  `public/logo/symbol-light.svg`와 같은 도형이다. 파일을 불러오지 않고 인라인으로
  둔다. 468바이트짜리 마크에 요청을 한 번 더 쓸 이유가 없고, 헤더는 첫 화면에
  바로 보이는 자리라 로드 전 빈칸이 생기면 그대로 눈에 띈다.

  ⚠️ 두 색은 브랜드에 묶여 있으므로 `currentColor`를 쓰지 않는다.
     대신 토큰을 참조해 팔레트가 바뀌면 로고도 따라오게 한다.
     원본 SVG는 #222222·#D9453C인데, 화면의 먹색은 조금 따뜻한 #1F1B17이다.

  원본과 파생물(파비콘·PNG·락업)은 public/logo/에 있다. 그쪽이 정본이므로
  도형을 고칠 일이 생기면 두 곳을 함께 고쳐야 한다.
-->
<template>
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <g transform="translate(21,41) rotate(18)" fill="var(--color-ink)">
      <ellipse cx="0" cy="-6.4" rx="6.2" ry="8.8" />
      <ellipse cx="-0.5" cy="8.2" rx="4.7" ry="5.2" />
    </g>
    <g transform="translate(43,23) rotate(18)" fill="var(--color-primary)">
      <ellipse cx="0" cy="-6.4" rx="6.2" ry="8.8" />
      <ellipse cx="-0.5" cy="8.2" rx="4.7" ry="5.2" />
    </g>
  </svg>
</template>
