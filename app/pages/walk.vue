<script setup lang="ts">
import { COURSES } from '~/data/courses'

/**
 * 걷는 길 — 버스 없이 걸어서 이어지는 코스
 *
 * 데이터가 정적이므로 이 화면은 상류 장애의 영향을 받지 않는다.
 * 버스가 끊긴 시간대에 여행자에게 남는 유일한 선택지이기도 하다.
 */
useHead({ title: '걷는 길 · 안동잇다' })
</script>

<template>
  <div class="mx-auto max-w-[1080px] px-6 pb-12">
    <div class="py-6 pb-4">
      <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
        걷는 길
      </h1>
      <p class="mt-1.5 text-sm leading-relaxed text-muted">
        버스 없이 걸어서 이어지는 길만 골랐어요
      </p>
    </div>

    <article
      v-for="course in COURSES"
      :key="course.id"
      class="mb-4 overflow-hidden rounded-md border border-hairline"
    >
      <div class="p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold leading-tight tracking-[-0.18px]">
              {{ course.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ course.distanceKm }}km · 약 {{ course.minutes }}분 · {{ course.terrain }}
            </p>
          </div>
          <span
            class="flex-none rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold"
          >
            {{ course.timeOfDay }}
          </span>
        </div>

        <ol class="mt-4">
          <li v-for="(step, index) in course.steps" :key="step.name" class="flex items-start gap-3">
            <span class="flex w-3.5 flex-none flex-col items-center self-stretch">
              <span class="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />
              <span
                v-if="index < course.steps.length - 1"
                class="min-h-[18px] w-[1.5px] flex-1 bg-hairline"
              />
            </span>
            <span class="block pb-4">
              <b class="block text-base font-normal leading-relaxed">{{ step.name }}</b>
              <span class="block text-sm leading-relaxed text-muted">{{ step.detail }}</span>
            </span>
          </li>
        </ol>

        <div
          class="flex flex-wrap gap-6 border-t border-hairline-soft pt-4 text-sm text-muted"
        >
          <span v-for="caution in course.cautions" :key="caution">{{ caution }}</span>
        </div>
      </div>
    </article>

    <p class="text-[13px] leading-relaxed text-muted">
      낙강물길공원은 2028년까지 공사 중이라 코스에서 뺐어요.
    </p>
  </div>
</template>
