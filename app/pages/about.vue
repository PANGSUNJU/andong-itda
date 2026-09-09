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
 * ⚠️ 영문도 **같은 강도로** 옮긴다. 한계를 밝히는 문장이 이 서비스의 알맹이라
 *    (ADR-016) 영문에서만 부드럽게 옮기면 영어 사용자만 근거 없는 확신을 갖는다.
 *
 * TODO 공공누리 유형(제1~4유형)을 아직 확인하지 못했다. 데이터셋 상세 페이지에서
 *      확인한 뒤 각 항목에 유형을 명시한다. 유형 표기가 없어도 출처 표시 의무는
 *      아래 서술로 이행되지만, 유형까지 밝히는 것이 정식이다.
 */
const t = useT()

usePageTitle(() => t.value.about.title)
</script>

<template>
  <div class="mx-auto max-w-[720px] px-6 pb-12">
    <div class="py-6 pb-4">
      <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        {{ t.about.heading }}
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        {{ t.about.sub }}
      </p>
    </div>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
        {{ t.about.sourcesHead }}
      </h2>

      <dl class="flex flex-col gap-3 text-base leading-relaxed text-body">
        <div>
          <dt class="font-medium">{{ t.about.sourceSpotsTerm }}</dt>
          <dd class="text-muted">{{ t.about.sourceSpotsDesc }}</dd>
        </div>
        <!--
          축제는 헤더 아이콘이 열릴 때만 나타나므로, 축제가 없는 날에는 화면
          어디에도 이 데이터를 쓴다는 흔적이 남지 않는다. 출처는 여기가 상시로
          떠맡는다. 기능이 조건부라고 출처까지 조건부일 이유는 없다. → ADR-035
        -->
        <div>
          <dt class="font-medium">{{ t.about.sourceFestivalTerm }}</dt>
          <dd class="text-muted">{{ t.about.sourceFestivalDesc }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ t.about.sourceWalkTerm }}</dt>
          <dd class="text-muted">{{ t.about.sourceWalkDesc }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ t.about.sourceBusTerm }}</dt>
          <dd class="text-muted">{{ t.about.sourceBusDesc }}</dd>
        </div>
        <div>
          <dt class="font-medium">{{ t.about.sourceTimetableTerm }}</dt>
          <dd class="text-muted">{{ t.about.sourceTimetableDesc }}</dd>
        </div>
      </dl>

      <p class="mt-4 text-sm leading-relaxed text-muted-soft">
        {{ t.about.sourcesNote }}
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
        {{ t.about.limitsHead }}
      </h2>

      <p class="text-base leading-relaxed text-body">
        {{ t.about.limitsRealtime }}
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        {{ t.about.limitsScheduleLead }}
        <b class="font-semibold">{{ t.about.limitsScheduleStrong }}</b>
        {{ t.about.limitsScheduleTail }}
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        {{ t.about.limitsMissed }}
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
        {{ t.about.locationHead }}
      </h2>

      <p class="text-base leading-relaxed text-body">
        {{ t.about.locationIntro }}
      </p>

      <ul class="mt-3 flex flex-col gap-2 text-base leading-relaxed text-body">
        <li>
          {{ t.about.locationPoint1Lead
          }}<b class="font-semibold">{{ t.about.locationPoint1Strong }}</b
          >{{ t.about.locationPoint1Tail }}
        </li>
        <li>{{ t.about.locationPoint2 }}</li>
        <li>{{ t.about.locationPoint3 }}</li>
      </ul>

      <p class="mt-4 text-base leading-relaxed text-body">{{ t.about.locationCaveatLead }}</p>

      <ul class="mt-2 flex flex-col gap-2 text-base leading-relaxed text-muted">
        <li>{{ t.about.locationCaveat1 }}</li>
        <li>{{ t.about.locationCaveat2 }}</li>
      </ul>
    </section>

    <section class="border-t border-hairline py-8">
      <h2 class="mb-3 text-[22px] font-medium leading-tight tracking-[-0.44px]">
        {{ t.about.privacyHead }}
      </h2>

      <p class="text-base leading-relaxed text-body">
        {{ t.about.privacy1 }}
      </p>

      <p class="mt-3 text-base leading-relaxed text-body">
        {{ t.about.privacy2 }}
      </p>
    </section>

    <section class="border-t border-hairline py-8">
      <p class="text-sm leading-relaxed text-muted-soft">
        {{ t.about.closing }}
      </p>
    </section>
  </div>
</template>
