<script setup lang="ts">
// Secret unlock — same hub flow as the showcase (bundle fetch + on-password unlock),
// plain Nuxt UI presentation.
import { ref } from 'vue'

const { unlock, locked } = useVault()
const route = useRoute()
const pass = ref('')
const error = ref(false)
const busy = ref(false)

if (!locked.value) navigateTo('/records')

async function go() {
  if (!pass.value || busy.value) return
  busy.value = true
  error.value = false
  try {
    await unlock(pass.value)
    await navigateTo((route.query.redirect as string) || '/records')
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-6">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-bold text-highlighted">Vinyl</h1>
        <p class="text-sm text-muted">noy-db · encrypted vault · plain fork</p>
      </template>

      <div class="space-y-4">
        <UAlert
          color="neutral"
          variant="subtle"
          title="Secret hint"
          description="spin-the-black-circle"
        />
        <UInput
          v-model="pass"
          type="password"
          placeholder="secret"
          class="w-full"
          autofocus
          @keydown.enter="go"
        />
        <UAlert v-if="error" color="error" variant="subtle" title="Wrong secret" />
        <UButton block :loading="busy" @click="go">Unlock</UButton>
      </div>
    </UCard>
  </div>
</template>
