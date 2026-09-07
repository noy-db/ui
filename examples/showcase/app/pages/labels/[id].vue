<script setup lang="ts">
import { useFoundSet, setReturnAnchor, useTraverse, pathSegments, rememberDirection, recallDirection, relatedColumns, summaryCards, type SummaryCard } from '@noy-db/ui'
import { count, sum, avg } from '@noy-db/hub/reduce'
import { useVault } from '../../composables/useVault'
import { useShowcaseI18n } from '../../composables/useShowcaseI18n'
import { buildRecordsView } from '../../lib/collectionView'
import { COUNTRY_LABELS } from '../../../src/data/dicts'

const route = useRoute()
const router = useRouter()
const { vault } = useVault()

const id = route.params.id as string
const record = await vault.value!.collection('labels').get(id, { locale: 'raw' })
const { fieldLabel, enumLabel, locale } = useShowcaseI18n()
// re-label per active locale (fieldLabel reads the locale ref -> computed re-tracks)
const fields = computed(() => vault.value!.collection('labels').describe().fields.map((f) => {
  const l = fieldLabel('labels', f.key)
  return l === f.key ? f : { ...f, label: l }
}))

// dict-dimension display labels at the ACTIVE locale (read mode resolves via options).
const options = computed(() => ({
  country: Object.keys(COUNTRY_LABELS).map((v) => ({ value: v, label: enumLabel('country', v) })),
}))

// Found-set traversal (spec §4): the list's captured snapshot drives the skim/step cluster;
// a missing record (deleted between capture and visit) auto-advances past it.
const { snapshot } = useFoundSet('labels')
// `traverse` is referenced inside its own onSettle closure — safe: the closure only runs on a
// later go()/goTo() call, by which point `const traverse` has been initialized.
const traverse = useTraverse({
  snapshot: () => snapshot.value,
  currentId: () => (route.params.id as string),
  onSettle: (nid) => { rememberDirection('labels', traverse.lastDirection.value); router.replace(`/labels/${nid}`) },
})
if (!record && snapshot.value) traverse.go(recallDirection('labels'))

function goBack(): void {
  if (snapshot.value) setReturnAnchor('labels', { query: snapshot.value.query, id: String(route.params.id) })
  navigateTo('/labels')
}

// `name` is read raw (a locale map, spec: no re-localizing a frozen found-set label) — use its
// first non-empty translation, falling back to the frozen cursor label, then the bare id.
function firstLocaleValue(map: unknown): string | undefined {
  if (!map || typeof map !== 'object') return undefined
  return Object.values(map as Record<string, string>).find((v) => v)
}
const segments = computed(() => pathSegments({
  item: traverse.cursorItem.value,
  record: null,
  fields: fields.value,
  titleLabel: traverse.cursorItem.value?.label
    ?? firstLocaleValue((record as any)?.name)
    ?? String(route.params.id),
}))

// Related list (P6): this label's records — reverse-lookup + derived summary. The joined/localized
// records view (title, artist name, enum keys) is filtered to this label; the summary comes from
// the SAME query's hub-side aggregate (count / total value / avg rating), demonstrating T6.
const records = vault.value!.collection('records')
const view = computed(() => buildRecordsView(vault.value!))
const relatedRows = computed(() => (view.value.rows as Record<string, any>[]).filter((r) => r.labelId === id))
const relatedCols = computed(() => relatedColumns(view.value.columns, ['title', 'artist_name', 'year', 'genre', 'priceUsd', 'rating']))
const L = (en: string, th: string) => (locale.value === 'th' ? th : en)
const summary = computed<SummaryCard[]>(() => {
  const agg = records.query().where('labelId', '==', id).aggregate({
    n: count(), total: sum('priceUsd'), avgRating: avg('rating'),
  }).run() as { n: number; total: number | null; avgRating: number | null }
  return summaryCards(agg, [
    { key: 'n', label: L('Records', 'อัลบั้ม'), icon: 'i-lucide-disc-3', color: 'primary' },
    { key: 'total', label: L('Catalog value', 'มูลค่ารวม'), icon: 'i-lucide-dollar-sign', color: 'success', format: (v) => (v == null ? '—' : `$${Math.round(v)}`) },
    { key: 'avgRating', label: L('Avg rating', 'คะแนนเฉลี่ย'), icon: 'i-lucide-star', color: 'warning', format: (v) => (v == null ? '—' : `★ ${v.toFixed(1)}`) },
  ])
})
</script>

<template>
  <article v-if="record" class="p-4 space-y-6">
    <TraverseBar
      v-if="snapshot"
      :snapshot="snapshot" :position="traverse.position.value"
      :skimming="traverse.skimming.value"
      @go="traverse.go" @go-to="traverse.goTo" @first="traverse.first" @last="traverse.last" @back="goBack"
    />
    <NuxtLink v-else to="/labels" class="text-sm text-nui-accent hover:underline">← labels</NuxtLink>
    <ItemPath
      :segments="segments"
      @back="goBack"
      @navigate="(r) => navigateTo(`/${r.collection}/${r.id}`)"
    />
    <div :class="traverse.skimming.value ? 'opacity-60 pointer-events-none' : ''">
      <RecordDetail
        :record="record"
        :fields="fields"
        :options="options"
        :route-for="(c: string, i: string) => `/${c}/${i}`"
        @navigate="(e: { collection: string; id: string }) => navigateTo(`/${e.collection}/${e.id}`)"
      />
      <RelatedList
        class="mt-4"
        :title="L('Records', 'อัลบั้ม')"
        :summary="summary"
        :columns="relatedCols"
        :rows="relatedRows"
        :row-key="(r) => String(r.id)"
        @row-click="(r) => navigateTo(`/records/${r.id}`)"
      >
        <template #cell-genre="{ row }">{{ enumLabel('genre', String(row.genre ?? '')) }}</template>
      </RelatedList>
    </div>
  </article>
  <p v-else class="p-4">Not found.</p>
</template>
