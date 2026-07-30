// server/api/test.get.ts
export default defineEventHandler(() => {
  const key = useRuntimeConfig().tourApiKey
  return { hasKey: !!key, length: key?.length ?? 0 }
})