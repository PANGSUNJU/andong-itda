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
const t = useT()
const d = useDisplay()

usePageTitle(() => t.value.browse.title)

// 두 목록은 서로를 기다릴 이유가 없다. 순차로 await하면 SSR에서 왕복이 두 번 쌓인다.
const [{ data: spots }, { data: foods }] = await Promise.all([
  useFetch<Spot[]>('/api/spots', { default: () => [] }),
  useFetch<FoodPlace[]>('/api/food', { default: () => [] }),
])

const tab = ref<'spots' | 'food'>('spots')

/** 탭 이름. 검색 라벨과 지도 캡션이 이 문구를 그대로 받아 쓴다. */
const tabLabel = computed(() => ({
  spots: t.value.browse.tabSpots,
  food: t.value.browse.tabFood,
}))

const counts = computed(() => ({ spots: spots.value.length, food: foods.value.length }))

/**
 * ⚠️ 칩이 들고 있는 값은 **분류의 원본 문자열**이다(국문). 화면에만 옮겨 그린다.
 *    번역된 문자열을 상태에 담으면 `spot.category === '역사관광'` 비교가 영문
 *    화면에서 전부 어긋나 목록이 통째로 빈다.
 */
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

/**
 * 이름과 주소 둘 다에서 찾는다. "석주로"로 헛제삿밥 두 곳이 함께 잡힌다.
 *
 * 영문명도 함께 본다. 영문 화면에서 "Hahoe"를 친 사람에게 국문 이름만 뒤져
 * 0곳을 돌려주면, 화면에 보이는 그 이름으로는 검색이 안 되는 셈이 된다.
 * 대소문자는 무시한다 — 상류 영문명이 "Andong Folk Village" 꼴이다.
 */
function matchesKeyword(place: Spot): boolean {
  const query = keyword.value.trim()
  if (!query) return true

  return (
    place.name.includes(query) ||
    Boolean(place.address?.includes(query)) ||
    Boolean(place.nameEn?.toLowerCase().includes(query.toLowerCase()))
  )
}

const visibleSpots = computed(() =>
  spots.value
    .filter((spot) => spotCategory.value === ALL || spot.category === spotCategory.value)
    .filter(matchesKeyword)
    .sort((a, b) =>
      // 이름순은 화면에 보이는 이름으로 줄을 세운다. → `useDisplay().compareNames`
      sort.value === 'name' ? d.compareNames(a, b) : (a.rank ?? Infinity) - (b.rank ?? Infinity),
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

const mapCaption = computed(() =>
  t.value.browse.mapCaption(tabLabel.value[tab.value], visible.value.length),
)
</script>

<template>
  <div class="mx-auto max-w-[1280px] px-6 wide:max-w-[1440px]">
    <div class="desktop:grid desktop:grid-cols-[minmax(0,1fr)_372px] desktop:gap-x-12 desktop:items-start">
      <div class="min-w-0 pb-12">
        <div class="py-6 pb-4">
          <h1 class="text-[26px] font-semibold leading-tight tracking-[-0.18px] tablet:text-[28px]">
            {{ t.browse.heading }}
          </h1>
          <p v-if="tab === 'spots'" class="mt-1.5 text-sm leading-relaxed text-muted">
            {{ t.browse.subSpots(spots.length) }}
          </p>
          <p v-else class="mt-1.5 text-sm leading-relaxed text-muted">
            {{ t.browse.subFood(foods.length) }}
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
            :placeholder="tab === 'spots' ? t.browse.searchSpots : t.browse.searchFood"
            :aria-label="t.browse.searchLabel(tabLabel[tab])"
            class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </label>

        <div class="mb-4 flex gap-8 border-b border-hairline" role="tablist">
          <button
            v-for="(label, key) in tabLabel"
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
              <!-- 값은 국문 원본, 글자만 지금 언어다. 모르는 분류는 국문 그대로 나간다. -->
              {{ name === ALL ? t.common.all : d.category(name) }}
            </button>
          </div>

          <div class="mb-4 flex items-center justify-between gap-3">
            <p class="text-sm text-muted">{{ t.common.places(visibleSpots.length) }}</p>
            <div class="flex overflow-hidden rounded-full border border-hairline">
              <button
                v-for="option in [
                  { key: 'rank', label: t.browse.sortRank },
                  { key: 'name', label: t.browse.sortName },
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
            {{ t.browse.empty(keyword) }}
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
              <!-- 음식 분류는 우리가 정의한 닫힌 집합이라 전부 옮길 수 있다. → ADR-023 -->
              {{ name === ALL ? t.common.all : d.category(name) }}
            </button>
          </div>

          <p class="mb-4 text-sm text-muted">{{ t.common.places(visibleFoods.length) }}</p>

          <!--
            카드에 상세 링크를 붙이지 않는다(to=null). /spots/[id]는 /api/spots에서
            id를 찾는데 음식점은 거기 없어 404가 된다. → ADR-023
          -->
          <div v-if="visibleFoods.length" class="grid grid-cols-2 gap-x-4 gap-y-6 tablet:grid-cols-3 wide:grid-cols-4">
            <SpotCard v-for="food in visibleFoods" :key="food.id" :spot="food" :to="null" />
          </div>

          <p v-else class="py-16 text-center text-sm text-muted">
            {{ t.browse.empty(keyword) }}
          </p>

          <!--
            사진 없는 카드가 16곳 중 7곳이다. 폴백이 고장으로 보이지 않게 이유를 적는다.
            보충 로직으로도 못 채운다. 상류에 이미지 자체가 없다. → ADR-023
          -->
          <p class="mt-8 border-t border-hairline pt-4 text-xs leading-relaxed text-muted-soft">
            {{ t.browse.foodNote }}
          </p>
        </template>
      </div>

      <aside class="mt-8 min-w-0 pb-12 desktop:mt-0 desktop:sticky desktop:top-[96px]">
        <MapCard height="340px" :markers="mapMarkers" :caption="mapCaption" />
      </aside>
    </div>
  </div>
</template>
