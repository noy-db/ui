import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useNoydbUi, type VoiceSource } from './provider'
// Speech-to-text input. Uses the configured VoiceSource, else falls back to the browser Web Speech
// API. Emits a growing transcript + a final string; swap the source (AI-Edge/Whisper) without
// touching callers. Used by SearchBox/NlSearch (voice search) and editable fields.
function webSpeechSource(lang: string, continuous: boolean): VoiceSource {
  const SR = (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition
  let rec: any = null
  return {
    supported: !!SR,
    start(h) {
      if (!SR) return
      rec = new SR(); rec.lang = lang; rec.interimResults = true; rec.continuous = continuous
      rec.onresult = (e: any) => { let t = ''; for (const r of e.results) t += r[0].transcript; h.onResult(t, e.results[e.results.length - 1].isFinal) }
      rec.onend = () => h.onEnd()
      rec.onerror = (e: any) => { h.onError?.(e?.error ?? 'error'); h.onEnd() }
      rec.start()
    },
    stop() { rec?.stop() },
  }
}
export function useVoiceInput(opts: { lang?: string; continuous?: boolean; onFinal?: (text: string) => void } = {}): {
  listening: Ref<boolean>; transcript: Ref<string>; error: Ref<string>; supported: boolean; start(): void; stop(): void; toggle(): void
} {
  // `continuous` = push-to-talk friendly: the engine keeps listening through pauses; the CALLER
  // ends the capture (release → stop()). Non-continuous keeps the tap-and-auto-end behavior.
  const src = useNoydbUi().voice ?? webSpeechSource(opts.lang ?? 'en-US', opts.continuous ?? false)
  const listening = ref(false); const transcript = ref('')
  /** Last recognition failure code ('not-allowed', 'network', 'audio-capture', …); '' when fine.
   *  Reset on every start. Hosts SHOW this — a capture that dies silently reads as a dead button. */
  const error = ref('')
  // Releasing may stop() BEFORE the engine marks the utterance final; onEnd (fired after pending
  // results flush) delivers whatever was heard, exactly once.
  let finalized = false
  function start(): void {
    if (!src.supported || listening.value) return
    listening.value = true; transcript.value = ''; error.value = ''; finalized = false
    src.start({
      onResult: (t, final) => { transcript.value = t; if (final) { finalized = true; opts.onFinal?.(t) } },
      onEnd: () => {
        listening.value = false
        if (!finalized && transcript.value.trim()) { finalized = true; opts.onFinal?.(transcript.value) }
      },
      onError: (code) => { error.value = code },
    })
  }
  function stop(): void { src.stop(); listening.value = false }
  onBeforeUnmount(stop)
  return { listening, transcript, error, supported: src.supported, start, stop, toggle: () => (listening.value ? stop() : start()) }
}
