<script setup lang="ts" generic="T extends Record<string, any>">
// Item family — a record's read view. Fields (from collection.describe()) render into responsive
// cards: labels/units/enum-labels derive from the metadata, PII is masked via `sensitivity`, and
// entity fields become links (transversal navigation) via `routeFor` + the `navigate` event.
// Cards derive from describe()'s group/order metadata (groupFields); the grid is container-measured
// (useContainerSize), not viewport-measured, like the list. i18n fields read with { locale: 'raw' }
// render one row per language. Schema-driven, Nuxt-UI-free; the edit form (RecordForm) is a sibling.
import { ref, computed } from 'vue'
import type { DescribedField } from '@noy-db/hub/introspection'
import {
  detailFields, formatDetailCell, groupFields, type DetailCell,
  fieldInput, formFields, fieldHint, type FieldInput,
} from '@noy-db/ui'
import { useNuiI18n } from '../../core/i18n'
import { useContainerSize } from '../../core/container'
import NuiText from '../NuiText.vue'
import FieldControl from '../../internal/FieldControl.vue'

const { t } = useNuiI18n()

const props = withDefaults(defineProps<{
  record: T
  /** `collection.describe().fields` for this record's collection. */
  fields: readonly DescribedField[]
  /** Card grouping override. Omit → derived from describe()'s field.group/order. */
  groups?: { title: string; keys: string[] }[]
  /** Build a route to a referenced record, e.g. (col, id) => `/${col}/~${id}`. */
  routeFor?: (collection: string, id: string) => string
  /** Reveal PII instead of masking. */
  reveal?: boolean
  /** Show an Edit affordance (emits `edit`). */
  editable?: boolean
  /** In-place edit mode: editable cells morph into their input widgets bound to `draft`. */
  editing?: boolean
  /** The working copy (from useRecordItem). The component mutates draft[key] in place. */
  draft?: Record<string, any> | null
  /** Per-field error text (from a failed put()). */
  errors?: Record<string, string>
  /** `{ value, label }` lists keyed by field key: select options in edit mode, AND the read-mode
   *  display labels for enum codes / bare entity ids (formatDetailCell's options). */
  options?: Record<string, { value: string; label: string }[]>
  /**
   * Async option resolvers keyed by field key, for lookup fields backed by a reference collection
   * (`fieldInput` gives those an `autocomplete` kind). Supplying `options` for the same field
   * instead renders a plain select.
   */
  search?: Record<string, (term: string) => Promise<readonly { value: string; label: string }[]>>
  submitting?: boolean
  /** Non-field failure message (generic banner over the cards). */
  errorBanner?: string | null
  /** Render the built-in edit/save/cancel action row. Set `false` to own those controls in the host
   *  (e.g. an edit icon in a masthead + a sticky save/cancel bar); the cells still morph on `editing`. */
  controls?: boolean
}>(), { reveal: false, editable: false, editing: false, submitting: false, controls: true })

const emit = defineEmits<{ edit: []; save: []; cancel: []; navigate: [{ collection: string; id: string }] }>()

const host = ref<HTMLElement | null>(null)
const { width, size } = useContainerSize(host)

// Card columns scale with the container: a wider surface fits MORE cards per row rather than
// stretching each one into a sparse, over-long block.
const cols = computed(() =>
  width.value >= 1700 ? 4
    : width.value >= 1160 ? 3
      : width.value >= 900 ? 2
        : 1,
)

const shown = computed(() => detailFields(props.fields))
const byKey = computed(() => new Map(shown.value.map((f) => [f.key, f])))

const editableKeys = computed(() => new Set(formFields(props.fields).map((f) => f.key)))

const cards = computed(() => {
  const groups = props.groups?.length
    ? props.groups.map((g) => ({ title: g.title, fields: g.keys.map((k) => byKey.value.get(k)).filter(Boolean) as DescribedField[] }))
    : groupFields(shown.value, t)
  return groups.map((g) => ({
    title: g.title,
    cells: g.fields.map((f) => ({
      cell: formatDetailCell(f, props.record, { reveal: props.reveal, options: props.options?.[f.key] }),
      input: fieldInput(f, props.options?.[f.key]) as FieldInput,
      hint: fieldHint(f),
      canEdit: editableKeys.value.has(f.key),
    })),
  }))
})

function linkHref(c: DetailCell): string | undefined {
  if (c.href) return c.href
  if (c.ref && props.routeFor) return props.routeFor(c.ref.collection, c.ref.id)
  return undefined
}
function onLink(c: DetailCell, e: MouseEvent): void {
  if (c.ref) { emit('navigate', c.ref); e.preventDefault() }
}
</script>

<template>
  <div ref="host" class="nui-detail space-y-4" :data-nui-size="size">
    <div v-if="controls && (editable || editing)" class="flex items-center justify-end gap-2">
      <template v-if="editing">
        <button type="button" class="nui-btn-ghost px-3 py-1.5" :disabled="submitting" @click="emit('cancel')">{{ t('nui.cancel', 'Cancel') }}</button>
        <button type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" :disabled="submitting" @click="emit('save')">
          {{ submitting ? '…' : t('nui.save', 'Save') }}
        </button>
      </template>
      <button v-else type="button" class="nui-btn bg-nui-accent text-nui-accent-fg px-3 py-1.5" @click="emit('edit')">
        <span class="i-lucide-pencil size-3.5" aria-hidden="true" /> {{ t('nui.detail.edit', 'Edit') }}
      </button>
    </div>
    <p v-if="editing && errorBanner" class="text-[11px] text-nui-danger">{{ errorBanner }}</p>

    <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }">
      <section v-for="card in cards" :key="card.title" class="nui-panel nui-card">
        <h3 class="text-xs font-medium uppercase tracking-wide text-nui-muted mb-3">{{ card.title }}</h3>
        <dl class="grid gap-x-6 gap-y-3" :class="width / cols < 420 ? 'grid-cols-1' : 'grid-cols-2'">
          <div
            v-for="(c, ci) in card.cells" :key="c.cell.key" class="min-w-0"
            :class="width / cols >= 420 && ((editing && c.input.kind === 'textarea') || (ci === card.cells.length - 1 && card.cells.length % 2 === 1)) ? 'col-span-2' : ''"
          >
            <dt class="text-xs text-nui-muted flex items-center gap-1">
              {{ c.cell.label }}
              <span v-if="editing && c.hint.required && c.canEdit" class="text-nui-danger" aria-hidden="true">*</span>
              <span v-if="editing && !c.canEdit" class="i-lucide-lock size-3 text-nui-subtle" :title="t('nui.detail.readonly', 'Read-only')" />
            </dt>
            <dd class="text-sm mt-0.5" :class="c.cell.empty ? 'text-nui-subtle' : 'text-nui-fg'">
              <FieldControl
                v-if="editing && c.canEdit && draft"
                :input="c.input" :model-value="draft[c.cell.key]" :error="errors?.[c.cell.key]" :hint="c.hint"
                :search="search?.[c.cell.key]"
                id-prefix="d" @update:model-value="(v) => { draft![c.cell.key] = v }"
              />
              <a
                v-else-if="linkHref(c.cell)" :href="linkHref(c.cell)" class="text-nui-accent hover:underline"
                @click="onLink(c.cell, $event)"
              >{{ c.cell.display }}</a>
              <template v-else-if="c.cell.i18n">
                <span v-for="e in c.cell.i18n" :key="e.locale" class="flex items-baseline gap-1.5 min-w-0">
                  <span
                    class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border"
                    :class="e.missing ? 'text-nui-subtle opacity-60' : 'text-nui-muted'"
                  >{{ e.locale }}</span>
                  <NuiText :reps="[e.display]" :class="e.missing ? 'text-nui-subtle' : ''" />
                </span>
              </template>
              <NuiText v-else :reps="[c.cell.display]" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.nui-card { padding: var(--nui-card-px, 1rem); }
[data-nui-size='md'] .nui-card { --nui-card-px: 0.75rem; }
[data-nui-size='sm'] .nui-card { --nui-card-px: 0.625rem; }
</style>
