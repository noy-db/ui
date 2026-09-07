import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { buildNlPrompt, extractDsl, validateDsl, type EntitySchema } from '@noy-db/ui'
import { useShowcaseI18n } from './useShowcaseI18n'
import { useApiKey } from './useApiKey'

/** The SearchBox instance surface the toolbar drives (see SearchBox defineExpose). */
export interface SearchBoxHandle {
  focus: () => void
  clear: () => void
  focused: boolean
  draft: string
  setDraft: (v: string) => void
}

/**
 * The search-toolbar interaction state shared by every list page (spec:
 * docs/superpowers/specs/2026-07-02-search-toolbar-interaction-design.md).
 * Voices: exact (deterministic, default) · ask (AI on the field, sticky) · speak (momentary
 * voice → AI). Plus the morphing reset (✕ draft / 🗑 all), the inline key sheet, and `/` focus.
 * Must be called during component setup (uses useLlm / useVoiceInput injection).
 */
export function useSearchVoices(query: Ref<string>, schema: () => EntitySchema) {
  const { t } = useShowcaseI18n()
  const { hasKey, saveKey } = useApiKey()
  const llm = useLlm()

  const searchBox = ref<SearchBoxHandle | null>(null)
  const searchMode = ref<'exact' | 'ask'>('exact')
  const nlLoading = ref(false)
  const nlError = ref('')
  const nlNote = ref('')
  const needKey = ref(false)
  const keyDraft = ref('')
  const keyEl = ref<HTMLInputElement | null>(null)
  // The key prompt must be LOUD on EVERY trigger (arming ✨, asking, speaking — even while the
  // sheet is already open): put the caret straight into it. "Press Enter, nothing happens" is
  // exactly what we can never allow.
  function demandKey(): void {
    needKey.value = true
    void nextTick(() => keyEl.value?.focus())
  }
  let errTimer: ReturnType<typeof setTimeout> | null = null
  let askSeq = 0 // bumped to abort: a stale response is ignored

  function onModeChange(m: 'exact' | 'ask'): void {
    searchMode.value = m
    if (m === 'ask' && !hasKey.value) { demandKey(); return }
    searchBox.value?.focus()
  }

  async function onAsk(nl: string): Promise<void> {
    if (!hasKey.value) { demandKey(); return }
    if (!llm) return
    const seq = ++askSeq
    nlLoading.value = true
    nlError.value = ''
    nlNote.value = ''
    try {
      const { system, user } = buildNlPrompt(schema(), nl, {
        currentDsl: query.value.trim() ? query.value : undefined, // refine is automatic
      })
      const raw = await llm.complete({ system, user })
      if (seq !== askSeq) return // aborted — draft stays, result discarded
      const rawDsl = extractDsl(raw)
      const { dsl, unknownFields } = validateDsl(rawDsl, schema())
      if (unknownFields.length) nlNote.value = `${t('nl.note', 'Ignored unknown fields:')} ${unknownFields.join(', ')}`
      query.value = dsl
      searchBox.value?.setDraft('') // consumed; the draft survives on failure/abort
    } catch (e: unknown) {
      if (seq !== askSeq) return
      nlError.value = e instanceof Error ? e.message : t('nl.error', 'Search failed')
      if (errTimer) clearTimeout(errTimer)
      errTimer = setTimeout(() => { nlError.value = '' }, 6000)
    } finally {
      if (seq === askSeq) nlLoading.value = false
    }
  }
  function onAbortAsk(): void { askSeq++; nlLoading.value = false }

  function saveKeyDraft(): void {
    const k = keyDraft.value.trim()
    if (!k) return
    saveKey(k)
    keyDraft.value = ''
    needKey.value = false
    searchBox.value?.focus()
  }

  // Speak: PUSH-TO-RECORD → the ask pipeline. Hold the mic to capture (continuous — the engine
  // doesn't self-stop at pauses), release to interpret: whatever was heard is finalized and sent
  // to AI. Interim transcript streams into the field while held. The sticky mode never changes.
  const { listening: micOn, transcript: micTranscript, error: micError, supported: micSupported, start: micStart, stop: micStop } = useVoiceInput({
    continuous: true,
    onFinal: (text: string) => { const s = text.trim(); if (s) { searchBox.value?.setDraft(s); void onAsk(s) } },
  })
  watch(micTranscript, (tr) => { if (micOn.value && tr) searchBox.value?.setDraft(tr) })
  // A capture that dies silently reads as a dead button — always say WHY recognition failed.
  const MIC_ERRORS: Record<string, string> = {
    'not-allowed': 'Microphone permission denied — allow the mic for this site and try again.',
    'audio-capture': 'No microphone found.',
    'network': 'Speech service unreachable (this browser may not support voice — try Chrome).',
    'no-speech': 'No speech detected — hold the mic and speak.',
  }
  watch(micError, (code) => {
    if (!code) return
    nlError.value = MIC_ERRORS[code] ?? t('nl.micError', `Voice input failed (${code}).`)
    if (errTimer) clearTimeout(errTimer)
    errTimer = setTimeout(() => { nlError.value = '' }, 6000)
  })
  function onSpeakStart(): void {
    if (!hasKey.value) { demandKey(); return }
    micStart()
    searchBox.value?.focus()
  }
  function onSpeakStop(): void {
    const hadCapture = micOn.value
    micStop()
    // Silence must not read as a dead button: releasing with nothing heard gets a gentle note.
    // (Give the engine a beat to flush late results before judging.)
    if (hadCapture) {
      setTimeout(() => {
        if (!micTranscript.value.trim() && !micError.value && !nlError.value) {
          nlNote.value = t('nl.noSpeech', 'No speech detected — hold the mic and speak.')
          setTimeout(() => { if (nlNote.value.includes('No speech')) nlNote.value = '' }, 4000)
        }
      }, 400)
    }
  }

  // Morphing reset (spec §4): ✕ discards the draft / aborts the flight; 🗑 erases the whole search.
  const resetFace = computed<'draft' | 'all' | 'none'>(() => {
    if (nlLoading.value || (searchBox.value?.draft ?? '').trim()) return 'draft'
    if (query.value.trim()) return 'all'
    return 'none'
  })
  function onReset(): void {
    if (resetFace.value === 'draft') { onAbortAsk(); searchBox.value?.setDraft('') }
    else if (resetFace.value === 'all') searchBox.value?.clear()
  }

  // `/` focuses the field in the current voice (spec §5).
  function onSlashKey(e: KeyboardEvent): void {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    e.preventDefault()
    searchBox.value?.focus()
  }
  onMounted(() => window.addEventListener('keydown', onSlashKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onSlashKey))

  return {
    searchBox, searchMode, nlLoading, nlError, nlNote, needKey, keyDraft, keyEl, hasKey,
    onModeChange, onAsk, onAbortAsk, saveKeyDraft,
    micOn, micSupported, onSpeakStart, onSpeakStop,
    resetFace, onReset,
  }
}
