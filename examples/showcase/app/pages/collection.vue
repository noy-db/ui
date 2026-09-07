<script setup lang="ts">
import { computed } from 'vue'
import { useVault } from '../composables/useVault'
import { buildRecordsView } from '../lib/collectionView'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'

const { vault } = useVault()
const { t } = useShowcaseI18n()

const stats = computed(() => {
  if (!vault.value) return { count: 0, totalValue: 0, distinctArtists: 0, avgRating: 0, favorites: 0 }
  const rows = buildRecordsView(vault.value).rows as Record<string, any>[]
  const count = rows.length
  const totalValue = rows.reduce((s, r) => s + (Number(r.priceUsd) || 0), 0)
  const distinctArtists = new Set(rows.map((r) => r.artist_name)).size
  const rated = rows.filter((r) => r.rating != null && r.rating !== '')
  const avgRating = rated.length ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length : 0
  const favorites = rows.filter((r) => r.favorite === true).length
  return { count, totalValue, distinctArtists, avgRating, favorites }
})
</script>

<template>
  <section class="p-6 space-y-6">
    <h1 class="collection-heading">{{ t('nav.collection', 'Collection') }}</h1>
    <div class="stat-grid">
      <StatCard
        :label="t('stat.records', 'Records')"
        :value="stats.count"
        icon="i-lucide-disc-3"
        color="primary"
      />
      <StatCard
        :label="t('stat.value', 'Collection value')"
        :value="'$' + stats.totalValue.toFixed(0)"
        icon="i-lucide-dollar-sign"
        color="success"
      />
      <StatCard
        :label="t('stat.artists', 'Artists')"
        :value="stats.distinctArtists"
        icon="i-lucide-mic-2"
        color="info"
      />
      <StatCard
        :label="t('stat.avgRating', 'Avg rating')"
        :value="stats.avgRating.toFixed(1) + ' ★'"
        icon="i-lucide-star"
        color="warning"
      />
      <StatCard
        :label="t('stat.favorites', 'Favorites')"
        :value="stats.favorites"
        icon="i-lucide-heart"
        color="error"
      />
    </div>
  </section>
</template>

<style scoped>
.collection-heading {
  font-size: 1.25rem;
  font-weight: var(--display-weight);
  font-family: var(--font-display);
  letter-spacing: var(--display-spacing);
  text-transform: var(--display-transform);
  color: var(--nui-fg);
  margin: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}
</style>
