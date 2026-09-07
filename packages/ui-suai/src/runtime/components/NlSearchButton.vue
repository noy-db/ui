<script setup lang="ts">
// AI search button (presentational). Collects the BYO API key (first use), the natural-language
// request, and a "refine current" toggle, and emits intents — the HOST wires the actual key
// storage + AI call (those are app/provider-specific). Nuxt-UI-free.
import { ref, watch } from 'vue'
import Popover from '../internal/Popover.vue'
import { useVoiceInput } from '../core/voice'
import { useNuiI18n } from '../core/i18n'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  /** Whether an API key is already stored (host-managed). */
  hasKey: boolean
  loading?: boolean
  /** Pre-formatted error text to show, if any. */
  error?: string
  /** Non-fatal note (e.g. "ignored unknown fields"). */
  note?: string
  /** Whether there's a current query to refine. */
  hasCurrentQuery?: boolean
}>(), { loading: false })

const emit = defineEmits<{
  saveKey: [key: string]
  forgetKey: []
  search: [payload: { nl: string; refine: boolean }]
}>()

const keyInput = ref('')
const nl = ref('')
const refine = ref(false)

function saveKey(): void { const k = keyInput.value.trim(); if (k) { emit('saveKey', k); keyInput.value = '' } }
function run(): void { if (nl.value.trim() && !props.loading) emit('search', { nl: nl.value, refine: refine.value }) }
function onClose(): void { keyInput.value = ''; nl.value = ''; if (micOn.value) micToggle() }

// Dictate the natural-language request. Web Speech API by default; host can inject a VoiceSource.
const { listening: micOn, transcript: micText, supported: micSupported, toggle: micToggle } = useVoiceInput({
  onFinal: (t) => { const s = t.trim(); if (s) nl.value = s },
})
watch(micText, (t) => { if (micOn.value) nl.value = t })
// clear the NL box once a search succeeds (host clears `note`/`error` and the result applies)
watch(() => props.loading, (l, prev) => { if (prev && !l && !props.error && !props.note) nl.value = '' })
</script>

<template>
  <Popover align="end" :label="t('nui.ai.title', 'AI search')" trigger-class="nui-icon-btn text-nui-accent size-6" @close="onClose">
    <span class="i-lucide-sparkles size-[1.3125rem]" aria-hidden="true" />

    <template #content>
      <div class="w-80 max-w-[92vw] p-3 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.ai.title', 'AI search') }}</span>
          <button v-if="hasKey" type="button" class="text-[11px] text-nui-muted hover:text-nui-accent" @click="emit('forgetKey')">{{ t('nui.ai.changeKey', 'Change key') }}</button>
        </div>

        <template v-if="!hasKey">
          <p class="text-xs text-nui-muted">{{ t('nui.ai.keyHint', 'Paste your API key — the host stores it (encrypted) and calls the AI directly from your browser.') }}</p>
          <input v-model="keyInput" type="password" class="nui-field" placeholder="sk-…" @keydown.enter="saveKey">
          <div class="flex items-center justify-end">
            <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg" :disabled="!keyInput.trim()" @click="saveKey">{{ t('nui.ai.saveKey', 'Save key') }}</button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-1">
            <input
              v-model="nl"
              class="nui-field"
              :placeholder="refine ? t('nui.ai.refinePlaceholder', 'Adjust the current query…') : t('nui.ai.placeholder', 'e.g. paid German invoices over 5000 this year')"
              :disabled="loading"
              @keydown.enter="run"
            >
            <button
              v-if="micSupported"
              type="button"
              class="nui-icon-btn size-7 shrink-0"
              :class="micOn ? 'text-red-500' : 'text-nui-muted'"
              :aria-label="micOn ? t('nui.voice.stop', 'Stop voice input') : t('nui.voice.dictate', 'Dictate request')"
              :aria-pressed="micOn"
              @click="micToggle"
            >
              <span class="i-lucide-mic size-3.5" :class="micOn ? 'animate-pulse' : ''" aria-hidden="true" />
            </button>
          </div>
          <div class="flex items-center justify-between gap-2">
            <label v-if="hasCurrentQuery" class="flex items-center gap-1.5 text-[11px] text-nui-muted cursor-pointer">
              <input v-model="refine" type="checkbox" class="size-3 accent-nui-accent"> {{ t('nui.ai.refine', 'refine current') }}
            </label>
            <span v-else />
            <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg" :disabled="!nl.trim() || loading" @click="run">
              {{ loading ? t('nui.ai.searching', 'Searching…') : t('nui.ai.search', 'Search') }}
            </button>
          </div>
          <p v-if="error" class="text-[11px] text-red-500">{{ error }}</p>
          <p v-if="note" class="text-[11px] text-amber-600">{{ note }}</p>
        </template>
      </div>
    </template>
  </Popover>
</template>
