<script setup lang="ts">
// Plain record detail: describe() fields + a record → a label/value grid via the engine's
// detailFields/formatDetailCell (same data path as ui-suai's RecordDetail — the rich version
// with blob gallery, history, related lists and traverse lives there). Entity references
// emit `ref` for the host to turn into a route; http(s) values render as links.
import { computed } from 'vue'
import { detailFields, formatDetailCell } from '@noy-db/ui'
import type { DescribedField } from '@noy-db/hub/introspection'

const props = defineProps<{
  fields: readonly DescribedField[]
  record: Record<string, unknown>
  /** Host-supplied `{ value, label }` display options per field (enum labels, entity names). */
  optionsFor?: (key: string) => readonly { value: string; label: string }[] | undefined
}>()
const emit = defineEmits<{ ref: [target: { collection: string; id: string }] }>()

const cells = computed(() =>
  detailFields(props.fields as DescribedField[]).map((f) =>
    formatDetailCell(f, props.record, { options: props.optionsFor?.(f.key) })),
)
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
    <div v-for="c in cells" :key="c.key" class="flex flex-col gap-0.5">
      <dt class="text-xs text-muted">{{ c.label }}</dt>
      <dd class="text-sm text-highlighted">
        <a v-if="c.href" :href="c.href" target="_blank" rel="noopener" class="text-primary underline">{{ c.display }}</a>
        <UButton
          v-else-if="c.ref"
          variant="link"
          class="p-0 text-sm"
          :label="c.display"
          @click="emit('ref', c.ref!)"
        />
        <template v-else-if="c.i18n">
          <span v-for="e in c.i18n" :key="e.locale" class="block">
            <span class="text-xs uppercase text-dimmed">{{ e.locale }}</span> {{ e.display }}
          </span>
        </template>
        <template v-else>{{ c.display }}</template>
      </dd>
    </div>
  </dl>
</template>
