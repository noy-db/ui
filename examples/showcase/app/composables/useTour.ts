import { ref } from 'vue'

export type TourStep = { target: string; title: string; body: string }

const steps = ref<TourStep[]>([])
const index = ref(0)
const active = ref(false)

export function useTour() {
  function start(s: TourStep[], opts: { force?: boolean; key?: string } = {}) {
    if (opts.key && !opts.force && typeof localStorage !== 'undefined' && localStorage.getItem(`tour:${opts.key}`)) return
    if (opts.key && typeof localStorage !== 'undefined') localStorage.setItem(`tour:${opts.key}`, '1')
    steps.value = s; index.value = 0; active.value = s.length > 0
  }
  const next = () => { if (index.value + 1 >= steps.value.length) active.value = false; else index.value++ }
  const prev = () => { if (index.value > 0) index.value-- }
  const skip = () => { active.value = false }
  return { steps, index, active, start, next, prev, skip }
}
