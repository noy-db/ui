// Item family — the edit state machine behind an in-place editable RecordDetail.
// Mirrors useCollectionList's position: vue-reactive, framework-light (no DOM, no lifecycle),
// testable against a structural collection fake. Validation belongs to noy-db: submit() calls
// put(), and a failure decomposes through fieldErrors into per-field messages.
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { fieldErrors } from './form'

/** Vault records are JSON-serializable by construction; a JSON round-trip clones through
 *  BOTH Vue's reactive proxies and the hub's sealed-view proxies (getters are invoked). */
function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Structural slice of a noy-db collection that the item machine needs. */
export interface ItemCollection<T> {
  get(id: string, readOptions?: unknown): Promise<T | null>
  put(id: string, record: T): Promise<void>
}

export function useRecordItem<T extends Record<string, any>>(opts: {
  collection: ItemCollection<T>
  id: string
  /** read options forwarded to get(); default { locale: 'raw' } so i18n fields edit as full maps. */
  readOptions?: unknown
}): {
  record: Ref<T | null>
  load: () => Promise<void>
  editing: Ref<boolean>
  draft: Ref<Record<string, any> | null>
  dirty: ComputedRef<boolean>
  errors: Ref<Record<string, string>>
  errorBanner: Ref<string | null>
  submitting: Ref<boolean>
  enterEdit: () => void
  cancel: () => void
  submit: () => Promise<boolean>
} {
  const readOptions = opts.readOptions ?? { locale: 'raw' }
  const record = ref<T | null>(null) as Ref<T | null>
  const editing = ref(false)
  const draft = ref<Record<string, any> | null>(null)
  const errors = ref<Record<string, string>>({})
  const errorBanner = ref<string | null>(null)
  const submitting = ref(false)

  const dirty = computed(() =>
    editing.value && draft.value !== null && record.value !== null
    && JSON.stringify(draft.value) !== JSON.stringify(record.value))

  async function load(): Promise<void> {
    record.value = await opts.collection.get(opts.id, readOptions)
  }

  function enterEdit(): void {
    if (record.value === null) return
    draft.value = cloneRecord(record.value) as Record<string, any>
    errors.value = {}
    errorBanner.value = null
    editing.value = true
  }

  function cancel(): void {
    editing.value = false
    draft.value = null
    errors.value = {}
    errorBanner.value = null
  }

  async function submit(): Promise<boolean> {
    if (draft.value === null || submitting.value) return false
    submitting.value = true
    errors.value = {}
    errorBanner.value = null
    try {
      await opts.collection.put(opts.id, cloneRecord(draft.value) as T)
      await load()
      editing.value = false
      draft.value = null
      return true
    } catch (err) {
      const mapped = fieldErrors(err)
      if (Object.keys(mapped).length > 0) errors.value = mapped
      else errorBanner.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      submitting.value = false
    }
  }

  return { record, load, editing, draft, dirty, errors, errorBanner, submitting, enterEdit, cancel, submit }
}
