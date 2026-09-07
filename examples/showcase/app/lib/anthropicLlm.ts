import Anthropic from '@anthropic-ai/sdk'
import type { LlmClient } from '@noy-db/ui-suai/core'

/** BYO-key Anthropic adapter. `getKey` is called per-request so the reactive key ref is always fresh. */
export function makeAnthropicLlm(getKey: () => string | null): LlmClient {
  return {
    async complete(prompt: { system: string; user: string }): Promise<string> {
      const apiKey = getKey()
      if (!apiKey) throw new Error('No API key')
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const resp = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      })
      return resp.content.find((b) => b.type === 'text')?.text ?? ''
    },
  }
}
