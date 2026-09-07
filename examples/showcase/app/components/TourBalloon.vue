<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue'
import { useTour } from '../composables/useTour'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

const { steps, index, active, next, prev, skip } = useTour()
const { t } = useShowcaseI18n()

const rect = ref<DOMRect | null>(null)
const step = computed(() => steps.value[index.value])

async function updateRect() {
  if (!active.value || !step.value) return
  await nextTick()
  const el = document.querySelector(step.value.target)
  rect.value = el ? el.getBoundingClientRect() : null
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

watch([index, active], updateRect, { immediate: true })
</script>

<template>
  <div v-if="active" class="nui-tour-overlay">
    <div
      class="nui-tour-balloon"
      :style="rect ? { top: rect.bottom + 12 + 'px', left: rect.left + 'px' } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }"
    >
      <h4 class="nui-tour-balloon__title">{{ step?.title }}</h4>
      <p class="nui-tour-balloon__body">{{ step?.body }}</p>
      <footer class="nui-tour-balloon__footer">
        <button class="nui-tour-btn" :disabled="index === 0" @click="prev">{{ t('tour.prev', 'Back') }}</button>
        <span class="nui-tour-counter">{{ index + 1 }} / {{ steps.length }}</span>
        <button class="nui-tour-btn nui-tour-btn--skip" @click="skip">{{ t('tour.skip', 'Skip') }}</button>
        <button class="nui-tour-btn nui-tour-btn--primary" @click="next">{{ t('tour.next', 'Next') }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.nui-tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.nui-tour-balloon {
  position: absolute;
  pointer-events: auto;
  background: var(--nui-surface, #fff);
  color: var(--nui-text, #222);
  border: 1px solid var(--nui-border, #e0e0e0);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  max-width: 320px;
  min-width: 220px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
}

.nui-tour-balloon__title {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nui-accent, #6366f1);
}

.nui-tour-balloon__body {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--nui-text, #444);
}

.nui-tour-balloon__footer {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.nui-tour-counter {
  flex: 1;
  text-align: center;
  font-size: 0.75rem;
  color: var(--nui-text-muted, #888);
}

.nui-tour-btn {
  background: none;
  border: 1px solid var(--nui-border, #e0e0e0);
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--nui-text, #222);
  transition: background 0.1s;
}

.nui-tour-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.nui-tour-btn:not(:disabled):hover {
  background: var(--nui-surface-hover, rgba(0, 0, 0, 0.06));
}

.nui-tour-btn--skip {
  color: var(--nui-text-muted, #888);
}

.nui-tour-btn--primary {
  background: var(--nui-accent, #6366f1);
  color: #fff;
  border-color: var(--nui-accent, #6366f1);
}

.nui-tour-btn--primary:not(:disabled):hover {
  background: var(--nui-accent-dark, #4f46e5);
}
</style>
