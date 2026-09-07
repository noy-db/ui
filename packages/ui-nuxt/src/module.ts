import { defineNuxtModule, addComponentsDir, addImportsDir, addPlugin, createResolver, installModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'

// @noy-db/ui-nuxt as a Nuxt module — the "configure once" surface of the Nuxt UI fork.
// Ensures @nuxt/ui is installed (components compose U* primitives), auto-registers the
// top-shelf components, auto-imports the core/ composables (useTheme / useVoiceInput /
// useNuiI18n / useLlm / useViewport / provideNoydbUi), and installs a plugin that wires
// theme + locale app-wide. Styling is Nuxt UI's own (Tailwind v4 + app.config theming) —
// this fork ships no CSS of its own; the flagship look lives in @noy-db/ui-suai.
export interface NoydbUiOptions {
  /** Initial theme. Default 'system'. */
  theme?: 'light' | 'dark' | 'system'
  /** Active locale for UI strings. Default 'en'. */
  locale?: string
  /** Auto-register the components. Default true. */
  components?: boolean
}

// explicit annotation so the emitted .d.ts can name the type (avoids TS2742 across pnpm paths)
const module: NuxtModule<NoydbUiOptions> = defineNuxtModule<NoydbUiOptions>({
  meta: { name: '@noy-db/ui-nuxt', configKey: 'noydbUi', compatibility: { nuxt: '>=3.0.0' } },
  defaults: { theme: 'system', locale: 'en', components: true },
  async setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // the component base — idempotent if the host already registers @nuxt/ui itself
    await installModule('@nuxt/ui')

    if (options.components) {
      // flat names (CollectionList, SearchBox, …); only the top-shelf dir is scanned.
      addComponentsDir({ path: resolve('./runtime/components'), pathPrefix: false, global: true })
    }

    // the one config surface — every core/ composable becomes available without an import
    addImportsDir(resolve('./runtime/core'))

    // hand the serializable bits (theme/locale) to the runtime plugin
    nuxt.options.runtimeConfig.public.noydbUi = { theme: options.theme ?? 'system', locale: options.locale ?? 'en' }
    addPlugin({ src: resolve('./runtime/plugin.client.ts'), mode: 'client' })
  },
})

export default module
