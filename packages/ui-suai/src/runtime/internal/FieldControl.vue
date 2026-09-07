<script setup lang="ts">
// Item family — ONE widget renderer per FieldInput kind, shared by RecordForm (create) and
// RecordDetail (in-place edit) so both surfaces stay pixel-consistent. Emits update:modelValue;
// i18n-text edits emit the whole updated locale map. Error/hint lines render under the control.
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import type { FieldInput, FieldHint } from '@noy-db/ui'

type Option = { value: string; label: string }

const props = withDefaults(defineProps<{
  input: FieldInput
  modelValue: any
  error?: string
  hint?: FieldHint
  /**
   * Resolve options for an `autocomplete` input (the lookup matrix tier). `input.lookup` names the
   * backing collection, key and display field; enumerating it is the host's job — describe() never
   * embeds a reference collection's rows.
   */
  search?: (term: string) => Promise<readonly Option[]>
  idPrefix?: string
}>(), { idPrefix: 'f' })

const emit = defineEmits<{ 'update:modelValue': [value: any] }>()
const id = computed(() => `${props.idPrefix}-${props.input.key}`)

// ── autocomplete ────────────────────────────────────────────────────────────
// Labels are only known for options the host has actually returned, so a stored key renders as
// itself until it has been seen once. Nothing here guesses at the backing collection.
const seen = new Map<string, string>()
const term = ref('')
const results = ref<readonly Option[]>([])
const open = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const committed = computed(() => {
  const v = props.modelValue
  return v == null || v === '' ? '' : (seen.get(String(v)) ?? String(v))
})
watch(committed, (v) => { term.value = v }, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

function onTerm(v: string): void {
  term.value = v
  open.value = true
  clearTimeout(timer)
  timer = setTimeout(async () => {
    const found = props.search ? await props.search(v) : []
    for (const o of found) seen.set(o.value, o.label)
    results.value = found
  }, 200)
}
function choose(o: Option): void {
  seen.set(o.value, o.label)
  open.value = false
  emit('update:modelValue', o.value)
}
function onBlur(): void {
  open.value = false
  // A closed vocabulary only accepts a value that exists in the backing collection, so free text
  // is discarded; an open one stores what was typed.
  if (props.input.lookup?.vocabulary === 'open') emit('update:modelValue', term.value || undefined)
  else term.value = committed.value
}

const i18nMap = computed<Record<string, string>>(() =>
  (typeof props.modelValue === 'object' && props.modelValue !== null) ? props.modelValue : {})
function setLocale(locale: string, v: string): void {
  emit('update:modelValue', { ...i18nMap.value, [locale]: v })
}
function num(v: string): void {
  emit('update:modelValue', v === '' ? undefined : Number(v))
}
</script>

<template>
  <div class="min-w-0">
    <template v-if="input.kind === 'i18n-text'">
      <div v-for="loc in input.locales" :key="loc" class="flex items-center gap-1.5 mb-1 last:mb-0">
        <span class="shrink-0 text-[10px] uppercase leading-4 px-1 rounded border border-nui-border text-nui-muted">{{ loc }}</span>
        <input
          :id="`${id}-${loc}`" type="text" class="nui-field flex-1"
          :value="i18nMap[loc] ?? ''" @input="setLocale(loc, ($event.target as HTMLInputElement).value)"
        >
      </div>
    </template>
    <textarea
      v-else-if="input.kind === 'textarea'" :id="id" rows="3" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <select
      v-else-if="input.kind === 'select'" :id="id" class="nui-field w-full"
      :value="modelValue ?? ''" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">—</option>
      <option v-for="o in input.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <div v-else-if="input.kind === 'autocomplete'" class="relative">
      <input
        :id="id" type="text" class="nui-field w-full" role="combobox" autocomplete="off"
        aria-autocomplete="list" :aria-expanded="open" :aria-controls="`${id}-list`"
        :value="term" @input="onTerm(($event.target as HTMLInputElement).value)"
        @focus="onTerm(term)" @blur="onBlur" @keydown.esc="open = false"
      >
      <ul
        v-if="open && results.length" :id="`${id}-list`" role="listbox"
        class="absolute z-20 mt-1 w-full max-h-56 overflow-auto nui-panel py-1 shadow-lg"
      >
        <li
          v-for="o in results" :key="o.value" role="option"
          :aria-selected="o.value === modelValue"
          class="px-2 py-1 text-sm cursor-pointer hover:bg-nui-subtle"
          @mousedown.prevent="choose(o)"
        >
          {{ o.label }}
        </li>
      </ul>
    </div>
    <label v-else-if="input.kind === 'checkbox'" class="flex items-center gap-2 h-9">
      <input
        :id="id" type="checkbox" class="accent-nui-accent"
        :checked="!!modelValue" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      > <span class="text-sm">{{ input.label }}</span>
    </label>
    <div v-else-if="input.kind === 'number'" class="flex items-center gap-1.5">
      <input
        :id="id" type="number" step="any" class="nui-field flex-1"
        :value="modelValue ?? ''" @input="num(($event.target as HTMLInputElement).value)"
      >
      <span v-if="input.unit" class="text-xs text-nui-muted shrink-0">{{ input.unit }}</span>
    </div>
    <input
      v-else :id="id" :type="input.kind === 'date' ? 'date' : 'text'" class="nui-field w-full"
      :value="modelValue ?? ''" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >

    <p v-if="error" class="text-[11px] text-nui-danger mt-1">{{ error }}</p>
    <p v-else-if="hint?.text" class="text-[11px] text-nui-subtle mt-1">{{ hint.text }}</p>
  </div>
</template>
