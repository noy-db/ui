<script setup lang="ts">
import { ref } from 'vue'
import { useVault } from '../composables/useVault'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

definePageMeta({ layout: false })

const { unlock } = useVault()
const { t } = useShowcaseI18n()
const route = useRoute()
const pass = ref('')
const error = ref('')
const busy = ref(false)
async function submit() {
  busy.value = true; error.value = ''
  try {
    await unlock(pass.value)
    // Restore the deep link a locked (e.g. cmd-clicked) tab was aiming for; else the collection.
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/records'
    await navigateTo(redirect)
  } catch { error.value = t('unlock.error', "That didn't unlock the vault.") }
  finally { busy.value = false }
}
</script>

<template>
  <main class="nui-unlock" data-tour="unlock">
    <div class="nui-unlock-card">
      <div class="nui-unlock-brand">
        <span class="nui-unlock-logo">Vinyl</span>
        <span class="nui-unlock-sub">noy-db · encrypted vault</span>
      </div>
      <div class="nui-unlock-hint">
        {{ t('unlock.hint', 'Secret hint') }}
        <code>spin-the-black-circle</code>
      </div>
      <form class="nui-unlock-form" @submit.prevent="submit">
        <input
          v-model="pass"
          class="nui-unlock-input"
          type="password"
          placeholder="secret"
          autofocus
        />
        <button class="nui-unlock-btn" :disabled="busy || !pass">
          {{ t('unlock.button', 'Unlock') }}
        </button>
      </form>
      <p v-if="error" class="nui-unlock-error" role="alert">{{ error }}</p>
    </div>
  </main>
</template>

<style>
.nui-unlock {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nui-bg);
  color: var(--nui-fg);
  font-family: var(--font-body);
  padding: 1rem;
}

.nui-unlock-card {
  width: 100%;
  max-width: 22rem;
  background: var(--nui-bg-accent);
  border: var(--border-w) solid var(--hairline);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.nui-unlock-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.nui-unlock-logo {
  font-family: var(--font-display);
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 2.25rem;
  color: var(--nui-accent);
  line-height: 1;
}

.nui-unlock-sub {
  font-size: 0.7rem;
  color: var(--nui-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.nui-unlock-hint {
  font-size: 0.8125rem;
  color: var(--nui-muted);
  text-align: center;
  line-height: 1.5;
  padding: 0.75rem 1rem;
  background: var(--nui-bg);
  border-radius: var(--radius-control);
  border: var(--border-w) solid var(--hairline);
}

.nui-unlock-hint code {
  font-family: var(--font-mono);
  color: var(--nui-accent);
  display: block;
  margin-top: 0.35rem;
  font-size: 0.875rem;
}

.nui-unlock-form {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.nui-unlock-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  background: var(--nui-bg);
  border: var(--border-w) solid var(--nui-border);
  border-radius: var(--radius-control);
  color: var(--nui-fg);
  font-family: var(--font-body);
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.15s;
}

.nui-unlock-input:focus {
  border-color: var(--nui-accent);
}

.nui-unlock-btn {
  width: 100%;
  padding: 0.6rem 1rem;
  background: var(--nui-accent);
  color: var(--nui-accent-fg);
  border: none;
  border-radius: var(--radius-control);
  font-family: var(--font-display);
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.nui-unlock-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nui-unlock-btn:not(:disabled):hover {
  opacity: 0.88;
}

.nui-unlock-error {
  color: var(--nui-badge-error-fg, #dc2626);
  font-size: 0.8125rem;
  text-align: center;
  margin: 0;
}
</style>
