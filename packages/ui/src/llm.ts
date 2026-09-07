import { useNoydbUi } from './provider'
/** The configured LLM client, or null when AI features aren't wired (callers degrade gracefully). */
export function useLlm() { return useNoydbUi().llm ?? null }
