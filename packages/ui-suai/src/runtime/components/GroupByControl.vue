<script setup lang="ts">
// Group-by control — visual counterpart to the `group:` search token. A dropdown of the groupable
// (categorical) fields; clicking one toggles it in the group-by chain (the trailing number shows
// nesting order). Expand/collapse-to-level actions appear once grouped. Nuxt-UI-free: reuses Popover.
import { computed } from 'vue'
import Popover from '../internal/Popover.vue'
import { useNuiI18n } from '../core/i18n'

const props = defineProps<{
  fields: { id: string; label: string }[]
  active: string[]
}>()
const emit = defineEmits<{
  toggle: [id: string]
  clear: []
  expandAll: []
  collapseLevel: [level: number]
}>()
const { t } = useNuiI18n()

const labelOf = (id: string) => props.fields.find((f) => f.id === id)?.label ?? id
const summary = computed(() => props.active.map(labelOf).join(' › '))
const isActive = (id: string) => props.active.includes(id)
</script>

<template>
  <Popover
    align="start"
    :label="active.length ? `${t('nui.group.by', 'Grouped by')} ${summary}` : t('nui.group.title', 'Group by')"
    :trigger-class="`nui-btn ${active.length ? 'bg-nui-bg-accent text-nui-accent' : 'text-nui-muted hover:bg-nui-bg-accent'}`"
  >
    <span class="i-lucide-group size-[1.3125rem]" aria-hidden="true" />

    <template #content="{ close }">
      <div class="w-56 py-1">
        <div class="flex items-center justify-between px-3 py-1.5 border-b border-nui-border">
          <span class="text-xs font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.group.title', 'Group by') }}</span>
          <button v-if="active.length" type="button" class="nui-btn-ghost" @click="emit('clear'); close()">{{ t('nui.clear', 'Clear') }}</button>
        </div>
        <ul class="py-1" role="listbox" aria-multiselectable="true">
          <li
            v-for="f in fields"
            :key="f.id"
            class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-nui-bg-accent"
            role="option"
            :aria-selected="isActive(f.id)"
            @click="emit('toggle', f.id)"
          >
            <span
              :class="[isActive(f.id) ? 'i-lucide-check text-nui-accent' : 'i-lucide-plus opacity-30', 'size-3.5 shrink-0']"
              aria-hidden="true"
            />
            <span class="flex-1">{{ f.label }}</span>
            <span v-if="isActive(f.id)" class="text-[11px] text-nui-muted tabular-nums">{{ active.indexOf(f.id) + 1 }}</span>
          </li>
        </ul>

        <div v-if="active.length" class="border-t border-nui-border mt-1 pt-1">
          <div class="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-nui-muted">{{ t('nui.group.expandCollapse', 'Expand / collapse') }}</div>
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-nui-bg-accent"
            @click="emit('expandAll'); close()"
          >
            <span class="i-lucide-chevrons-down-up size-3.5 shrink-0 rotate-180 text-nui-muted" aria-hidden="true" />
            <span class="flex-1">{{ t('nui.group.expandAll', 'Expand all') }}</span>
          </button>
          <button
            v-for="(id, i) in active"
            :key="id"
            type="button"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-nui-bg-accent"
            @click="emit('collapseLevel', i); close()"
          >
            <span class="i-lucide-chevrons-up-down size-3.5 shrink-0 text-nui-muted" aria-hidden="true" />
            <span class="flex-1">{{ t('nui.group.collapseTo', 'Collapse to') }} {{ labelOf(id) }}</span>
            <span class="text-[11px] text-nui-muted tabular-nums">{{ i + 1 }}</span>
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
