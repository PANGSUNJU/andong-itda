<script setup lang="ts">
/**
 * 안내 — 데이터 출처 · 정보의 한계 · 위치 처리 · 개인정보
 *
 * 네 가지가 한 페이지에 모인 이유가 각각 다르다.
 *   출처 표시   공공누리 이용조건상 유형과 무관하게 의무다
 *   정보 한계   버스 정보 오류로 여행자가 입는 손해에 대한 고지다.
 *               "언제 기준인지 밝힌 데이터"와 "그냥 틀린 데이터"는 다르게 평가된다
 *   위치 처리   좌표를 서버로 보내지 않는다는 사실의 근거 문서다 → ADR-024
 *   개인정보    받는 것이 없다는 사실 자체가 내용이다
 *
 * ⚠️ 여기 적은 것은 전부 코드가 실제로 하는 일이어야 한다.
 *    한 번 어긋난 적이 있다(ADR-024). 구조를 바꾸면 이 페이지부터 확인할 것.
 *
 * TODO 공공누리 유형(제1~4유형)을 아직 확인하지 못했다. 데이터셋 상세 페이지에서
 *      확인한 뒤 각 항목에 유형을 명시한다. 유형 표기가 없어도 출처 표시 의무는
 *      아래 서술로 이행되지만, 유형까지 밝히는 것이 정식이다.
 */
useHead({ title: '안내 · 안동잇다' })
</script>

<template>
  <div class="mx-auto max-w-[720px] px-6 pb-12">
    <div class="py-6 pb-4">
      <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        안내
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        이 서비스가 쓰는 데이터와, 알아두시면 좋은 것들이에요
      </p>
    </div>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">데이터 출처</h2>

      <dl class="flex flex-col gap-3 text-base leading-relaxed text-body">
        <div>
          <dt class="font-medium">관광지 정보 · 사진 · 인기 순위</dt>
          <dd class="text-muted">한국관광공사 TourAPI (공공누리)</dd>
        </div>
        <div>
          <dt class="font-medium">정류장 · 노선 · 실시간 도착</dt>
          <dd class="text-muted">안동시 버스정보시스템</dd>
        </div>
        <div>
          <dt class="font-medium">시내버스 운행시간표</dt>
          <dd class="text-muted">안동시 공공데이터</dd>
        </div>
      </dl>

      <p class="mt-4 text-sm leading-relaxed text-muted-soft">
        각 저작물의 권리는 해당 기관에 있어요. 인기 순위는 한국관광공사의 방문
        데이터를 그대로 따르고, 저희가 매기지 않아요.
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
        버스 정보의 한계
      </h2>

      <p class="text-base leading-relaxed text-body">
        도착 정보는 안동시 버스정보시스템의 실시간 데이터를 그대로 보여드려요.
        현장 상황에 따라 실제와 다를 수 있어요.
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        첫차 · 막차 시각은 안동시가 공개한 운행시간표에서 가져왔어요.
        <b class="font-semibold">일부 노선은 공식 시간표에 돌아오는 편 시각이 없어요.</b>
        그런 노선은 화면에 그 사실을 적어두고, 시각을 추측해서 채우지 않아요.
        돌아오는 편은 도착하신 뒤 현장에서 꼭 확인해 주세요.
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        버스를 놓치면 다음 차까지 오래 기다려야 하는 노선이 많아요. 일정이 걸려
        있는 이동은 안동시 교통 부서나 현장 안내로 한 번 더 확인해 주세요.
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">위치 정보</h2>

      <p class="text-base leading-relaxed text-body">
        '지금 여기' 화면에서 위치를 허용하시면, 브라우저가 알려준 좌표로 가까운
        정류장과 걸어서 다녀올 만한 곳을 찾아드려요.
      </p>

      <ul class="mt-3 flex flex-col gap-2 text-base leading-relaxed text-body">
        <li>
          좌표를 <b class="font-semibold">저희 서버로 보내지 않아요.</b> 정류장을
          고르는 계산까지 브라우저 안에서 끝나요
        </li>
        <li>좌표를 저장하지 않아요. 데이터베이스가 없고, 화면을 벗어나면 사라져요</li>
        <li>위치를 허용하지 않으셔도 안동역을 기준으로 똑같이 쓰실 수 있어요</li>
      </ul>

      <p class="mt-4 text-base leading-relaxed text-body">두 가지는 밝혀둘게요.</p>

      <ul class="mt-2 flex flex-col gap-2 text-base leading-relaxed text-muted">
        <li>
          지도는 카카오맵으로 그려요. 지도를 표시할 때 브라우저가 카카오 서버에
          지도 화면을 요청해요
        </li>
        <li>
          버스 도착 정보를 받으려면 어느 정류장인지는 알려야 해요. 정류장 번호로만
          조회하고, 그 요청에 좌표는 들어가지 않아요
        </li>
      </ul>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">개인정보</h2>

      <p class="text-base leading-relaxed text-body">
        회원가입도 로그인도 없어요. 이름 · 연락처 · 결제 정보처럼 개인을 알아볼 수
        있는 정보를 받지 않고, 그걸 담을 데이터베이스도 두지 않았어요.
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        웹사이트를 여는 것만으로 남는 접속 기록은 배포 환경이 자동으로 처리하는
        부분이라, 저희가 따로 들여다보거나 다른 목적으로 쓰지 않아요.
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <p class="text-sm leading-relaxed text-muted-soft">
        안동잇다는 한국관광공사 2026 관광데이터 활용 공모전 출품작이에요. 차 없이
        안동을 여행하는 분들을 위해 만들었어요.
      </p>
    </section>
  </div>
</template>
