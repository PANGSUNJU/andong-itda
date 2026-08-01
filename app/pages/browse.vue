<script setup lang="ts">
import type { Spot } from '#shared/types/tour'

/**
 * 둘러보기 — 관광지 목록
 *
 * 카테고리 칩은 하드코딩하지 않고 응답에서 만든다. 분류는 상류(LocgoHub의
 * hubCtgryMclsNm)가 정하는 값이라 우리가 목록을 고정하면 상류가 바뀔 때
 * 조용히 빈 칩이 남는다.
 */
useHead({ title: '둘러보기 · 안동잇다' })

const { data: spots } = await useFetch<Spot[]>('/api/spots', { default: () => [] })

const TAB = { spots: '관광지', food: '식도락' } as const
const tab = ref<keyof typeof TAB>('spots')

const keyword = ref('')
const category = ref('전체')
const sort = ref<'rank' | 'name'>('rank')

const categories = computed(() => [
  '전체',
  ...[...new Set(spots.value.map((spot) => spot.category))].sort(),
])

const visible = computed(() => {
  const query = keyword.value.trim()

  return spots.value
    .filter((spot) => category.value === '전체' || spot.category === category.value)
    .filter((spot) => !query || spot.name.includes(query) || spot.address?.includes(query))
    .sort((a, b) =>
      sort.value === 'name'
        ? a.name.localeCompare(b.name, 'ko')
        : (a.rank ?? Infinity) - (b.rank ?? Infinity),
    )
})
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0 pb-12">
        <div class="py-6 pb-4">
          <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            안동 둘러보기
          </h1>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            한국관광공사 방문 데이터에 잡힌 관광지 {{ spots.length }}곳
          </p>
        </div>

        <label
          class="mb-6 flex h-14 w-full items-center gap-3 rounded-full border border-hairline bg-white pl-6 pr-2 shadow-float focus-within:border-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            class="h-[18px] w-[18px] flex-none text-muted"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5L21 21" />
          </svg>
          <input
            v-model="keyword"
            type="search"
            placeholder="관광지 이름으로 찾기"
            aria-label="관광지 검색"
            class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </label>

        <div class="mb-4 flex gap-8 border-b border-hairline" role="tablist">
          <button
            v-for="(label, key) in TAB"
            :key="key"
            role="tab"
            :aria-selected="tab === key"
            class="relative pb-3 text-base font-semibold leading-tight"
            :class="tab === key ? 'text-ink' : 'text-muted'"
            @click="tab = key"
          >
            {{ label }}
            <em v-if="key === 'spots'" class="ml-1.5 text-sm font-normal not-italic text-muted-soft">
              {{ spots.length }}
            </em>
            <span
              v-if="tab === key"
              class="absolute inset-x-0 -bottom-px h-0.5 bg-ink"
              aria-hidden="true"
            />
          </button>
        </div>

        <template v-if="tab === 'spots'">
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="name in categories"
              :key="name"
              class="rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
              :class="
                category === name
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline text-body hover:bg-surface-soft'
              "
              @click="category = name"
            >
              {{ name }}
            </button>
          </div>

          <div class="mb-4 flex items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ visible.length }}곳</p>
            <div class="flex overflow-hidden rounded-full border border-hairline">
              <button
                v-for="option in [
                  { key: 'rank', label: '인기순' },
                  { key: 'name', label: '이름순' },
                ]"
                :key="option.key"
                class="px-4 py-2 text-sm font-medium"
                :class="sort === option.key ? 'bg-ink text-white' : 'text-muted'"
                @click="sort = option.key as 'rank' | 'name'"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div v-if="visible.length" class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3 wide:grid-cols-4">
            <SpotCard v-for="spot in visible" :key="spot.id" :spot="spot" />
          </div>

          <p v-else class="py-16 text-center text-sm text-muted">
            "{{ keyword }}"에 해당하는 곳이 없어요
          </p>
        </template>

        <!--
          식도락은 데이터는 확인됐으나(음식점 16건, ADR-011) 서버 라우트가 아직 없다.
          빈 그리드를 보여주느니 상태를 그대로 적는다.
        -->
        <div v-else class="rounded-md border border-hairline bg-surface-soft px-6 py-16 text-center">
          <p class="text-base font-medium">식도락은 준비 중이에요</p>
          <p class="mt-1.5 text-sm leading-relaxed text-muted">
            헛제삿밥 · 찜닭 · 간고등어를 포함한 16곳을 정리하고 있어요
          </p>
        </div>
      </div>

      <aside class="mt-8 min-w-0 pb-12 desktop:mt-0 desktop:sticky desktop:top-[96px]">
        <MapCard height="340px" :caption="`관광지 ${spots.length}곳의 분포`" />
      </aside>
    </div>
  </div>
</template>
