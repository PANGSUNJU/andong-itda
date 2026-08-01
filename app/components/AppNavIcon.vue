<script setup lang="ts">
/** 하단 탭바 아이콘. 경로를 그대로 키로 쓴다. */
defineProps<{ name: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
    <template v-if="name === '/'">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    </template>
    <template v-else-if="name === '/browse'">
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="15" width="7" height="5" rx="1.5" />
      <rect x="14" y="15" width="7" height="5" rx="1.5" />
    </template>
    <template v-else>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M11 21l1.6-6L9 12l1-5 3.5 2.5L17 10M10 14l-2.5 7" />
    </template>
  </svg>
</template>
