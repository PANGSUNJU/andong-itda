<script setup lang="ts">
import { FOOD_CATEGORY_ORDER } from '#shared/constants/region'
import type { FoodPlace, Spot } from '#shared/types/tour'

/**
 * 둘러보기 — 관광지와 식도락
 *
 * 두 탭이 같은 카드·같은 필터를 쓰지만 분류를 만드는 방법이 반대다.
 *   관광지  칩을 응답에서 만든다. 분류가 상류(LocgoHub hubCtgryMclsNm)의 것이라
 *           목록을 고정하면 상류가 바뀔 때 조용히 빈 칩이 남는다
 *   식도락  칩을 상수에서 만든다. 분류가 우리가 정의한 닫힌 집합이라
 *           응답에서 뽑으면 순서가 데이터에 휘둘린다 → ADR-023
 *
 * 정렬도 갈린다. 음식점에는 hubRank가 없어서 "인기순"이라는 축이 아예 없다.
 * 없는 축을 비활성 버튼으로 남겨두지 않고 토글 자체를 관광지 탭에만 둔다.
 */
useHead({ title: '둘러보기 · 안동잇다' })

// 두 목록은 서로를 기다릴 이유가 없다. 순차로 await하면 SSR에서 왕복이 두 번 쌓인다.
const [{ data: spots }, { data: foods }] = await Promise.all([
  useFetch<Spot[]>('/api/spots', { default: () => [] }),
  useFetch<FoodPlace[]>('/api/food', { default: () => [] }),
])

const TAB = { spots: '관광지', food: '식도락' } as const
const tab = ref<keyof typeof TAB>('spots')

const counts = computed(() => ({ spots: spots.value.length, food: foods.value.length }))

const ALL = '전체'

const keyword = ref('')
// 칩 선택을 탭마다 따로 둔다. 하나로 묶으면 '역사관광'을 고른 채 식도락으로
// 넘어갔을 때 0곳이 뜬다. 사용자가 한 적 없는 필터가 걸려 있는 셈이다.
const spotCategory = ref<string>(ALL)
const foodCategory = ref<string>(ALL)
const sort = ref<'rank' | 'name'>('rank')

const spotCategories = computed(() => [
  ALL,
  ...[...new Set(spots.value.map((spot) => spot.category))].sort(),
])

/** 실제로 한 곳이라도 있는 분류만 보여준다. 상수에서 만들되 빈 칩은 남기지 않는다. */
const foodCategories = computed(() => [
  ALL,
  ...FOOD_CATEGORY_ORDER.filter((name) => foods.value.some((food) => food.category === name)),
])

/** 이름과 주소 둘 다에서 찾는다. "석주로"로 헛제삿밥 두 곳이 함께 잡힌다. */
function matchesKeyword(place: Spot): boolean {
  const query = keyword.value.trim()
  return !query || place.name.includes(query) || Boolean(place.address?.includes(query))
}

const visibleSpots = computed(() =>
  spots.value
    .filter((spot) => spotCategory.value === ALL || spot.category === spotCategory.value)
    .filter(matchesKeyword)
    .sort((a, b) =>
      sort.value === 'name'
        ? a.name.localeCompare(b.name, 'ko')
        : (a.rank ?? Infinity) - (b.rank ?? Infinity),
    ),
)

// 정렬하지 않는다. /api/food가 이미 분류 순서대로 준다. 그게 이 목록의 기본 순서다.
const visibleFoods = computed(() =>
  foods.value
    .filter((food) => foodCategory.value === ALL || food.category === foodCategory.value)
    .filter(matchesKeyword),
)

/**
 * 지도는 지금 보이는 목록만 그린다
 *
 * 전체를 그리면 칩으로 '카페'만 걸러 놓고도 지도에는 16곳이 찍혀 있게 된다.
 * 목록과 지도가 다른 말을 하면 둘 다 못 믿는다.
 */
const visible = computed<Spot[]>(() => (tab.value === 'spots' ? visibleSpots.value : visibleFoods.value))

const mapMarkers = computed(() =>
  visible.value.map((place) => ({ lat: place.lat, lng: place.lng, name: place.name })),
)

const mapCaption = computed(
  () => `${TAB[tab.value]} ${visible.value.length}곳의 분포`,
)
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0 pb-12">
        <div class="py-6 pb-4">
          <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            안동 둘러보기
          </h1>
          <p v-if="tab === 'spots'" class="mt-1.5 text-sm leading-relaxed text-muted">
            한국관광공사 방문 데이터에 잡힌 관광지 {{ spots.length }}곳
          </p>
          <p v-else class="mt-1.5 text-sm leading-relaxed text-muted">
            한국관광공사에 등록된 안동 음식점 {{ foods.length }}곳
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
            :placeholder="tab === 'spots' ? '관광지 이름으로 찾기' : '음식점 이름으로 찾기'"
            :aria-label="`${TAB[tab]} 검색`"
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
            <em class="ml-1.5 text-sm font-normal not-italic text-muted-soft">
              {{ counts[key] }}
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
              v-for="name in spotCategories"
              :key="name"
              class="rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
              :class="
                spotCategory === name
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline text-body hover:bg-surface-soft'
              "
              @click="spotCategory = name"
            >
              {{ name }}
            </button>
          </div>

          <div class="mb-4 flex items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ visibleSpots.length }}곳</p>
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

          <div v-if="visibleSpots.length" class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3 wide:grid-cols-4">
            <SpotCard v-for="spot in visibleSpots" :key="spot.id" :spot="spot" />
          </div>

          <p v-else class="py-16 text-center text-sm text-muted">
            "{{ keyword }}"에 해당하는 곳이 없어요
          </p>
        </template>

        <template v-else>
          <div class="mb-4 flex flex-wrap gap-2">
            <button
              v-for="name in foodCategories"
              :key="name"
              class="rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
              :class="
                foodCategory === name
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline text-body hover:bg-surface-soft'
              "
              @click="foodCategory = name"
            >
              {{ name }}
            </button>
          </div>

          <p class="mb-4 text-sm text-muted">{{ visibleFoods.length }}곳</p>

          <!--
            카드에 상세 링크를 붙이지 않는다(to=null). /spots/[id]는 /api/spots에서
            id를 찾는데 음식점은 거기 없어 404가 된다. → ADR-023
          -->
          <div v-if="visibleFoods.length" class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3 wide:grid-cols-4">
            <SpotCard v-for="food in visibleFoods" :key="food.id" :spot="food" :to="null" />
          </div>

          <p v-else class="py-16 text-center text-sm text-muted">
            "{{ keyword }}"에 해당하는 곳이 없어요
          </p>

          <!--
            사진 없는 카드가 16곳 중 7곳이다. 폴백이 고장으로 보이지 않게 이유를 적는다.
            보충 로직으로도 못 채운다. 상류에 이미지 자체가 없다. → ADR-023
          -->
          <p class="mt-8 border-t border-hairline pt-4 text-xs leading-relaxed text-muted-soft">
            음식점 정보는 한국관광공사 데이터라 사진과 전화번호가 없는 곳이 있어요.
          </p>
        </template>
      </div>

      <aside class="mt-8 min-w-0 pb-12 desktop:mt-0 desktop:sticky desktop:top-[96px]">
        <MapCard height="340px" :markers="mapMarkers" :caption="mapCaption" />
      </aside>
    </div>
  </div>
</template>
