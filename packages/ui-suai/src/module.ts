import { defineNuxtModule, addComponentsDir, addImportsDir, addPlugin, createResolver } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'

// @noy-db/ui-suai as a Nuxt module — the "configure once" surface. Auto-registers the top-shelf
// components, auto-imports the core/ composables (useTheme / useVoiceInput / useNuiI18n / useLlm /
// useViewport / provideNoydbUi), injects the pre-compiled CSS in the right order, and installs a
// plugin that wires theme + locale app-wide. A host on Tailwind/Nuxt UI consumes it with no
// CSS-engine conflict (the CSS is pre-built).
export interface NoydbUiOptions {
  /** Initial theme. Default 'system'. */
  theme?: 'light' | 'dark' | 'system'
  /** Active locale for UI strings. Default 'en'. */
  locale?: string
  /** Inject the pre-compiled tokens + utilities CSS. Default true. */
  css?: boolean
  /** Auto-register the components. Default true. */
  components?: boolean
}

// explicit annotation so the emitted .d.ts can name the type (avoids TS2742 across pnpm paths)
const module: NuxtModule<NoydbUiOptions> = defineNuxtModule<NoydbUiOptions>({
  meta: { name: '@noy-db/ui-suai', configKey: 'noydbUi', compatibility: { nuxt: '>=3.0.0' } },
  defaults: { theme: 'system', locale: 'en', css: true, components: true },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (options.components) {
      // flat names (CollectionList, SearchBox, …); only the top-shelf dir is scanned — internals
      // are explicitly imported by the components, never auto-registered.
      addComponentsDir({ path: resolve('./runtime/components'), pathPrefix: false, global: true })
    }

    // the one config surface — every core/ composable becomes available without an import
    addImportsDir(resolve('./runtime/core'))

    if (options.css) {
      // prepend so tokens + utilities load BEFORE the host's own CSS (its --nui-* brand map wins)
      nuxt.options.css.unshift('@noy-db/ui/tokens.css', '@noy-db/ui-suai/style.css')
    }

    // hand the serializable bits (theme/locale) to the runtime plugin
    nuxt.options.runtimeConfig.public.noydbUi = { theme: options.theme ?? 'system', locale: options.locale ?? 'en' }
    addPlugin({ src: resolve('./runtime/plugin.client.ts'), mode: 'client' })
  },
})

export default module
