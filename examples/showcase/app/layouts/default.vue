<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useShowcaseI18n } from '../composables/useShowcaseI18n'
import { useTour } from '../composables/useTour'
import { usePalette } from '../composables/usePalette'

const { t, locale, setLocale } = useShowcaseI18n()
const theme = useTheme()
const { palette, setPalette, initPalette } = usePalette()
const nav = [['/collection', 'nav.collection'], ['/records', 'nav.records'], ['/artists', 'nav.artists'], ['/labels', 'nav.labels']] as const
const { steps, start } = useTour()
const restartTour = () => start(steps.value, { force: true })

// Two responsive modes. Wide (≥1024px): a persistent rail that PUSHES content; `sidebarOpen`
// collapses it. Narrow: an OVERLAY drawer (off-canvas) that `drawerOpen` slides in over the content
// (full-screen at ≤480px). `isWide` flips between them; leaving narrow auto-closes the drawer.
const sidebarOpen = ref(true)
const drawerOpen = ref(false)
const isWide = ref(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
const onNavClick = () => { if (!isWide.value) drawerOpen.value = false }

onMounted(() => {
  initPalette()
  const mq = window.matchMedia('(min-width: 1024px)')
  isWide.value = mq.matches
  mq.addEventListener('change', (e) => { isWide.value = e.matches; if (e.matches) drawerOpen.value = false })
})

const palettes = [
  { id: 'bluenote' as const, label: 'Blue Note', accent: '#1c39bb', accentDark: '#6f86ff' },
  { id: 'hifi' as const, label: 'Hi-Fi', accent: '#c07f00', accentDark: '#ffb000' },
  { id: 'whitelabel' as const, label: 'White Label', accent: '#ff2d78', accentDark: '#ff2d78' },
  { id: 'speed' as const, label: 'Speed', accent: '#bb0231', accentDark: '#e0173f' },
] as const
</script>

<template>
  <div class="nui-shell">
    <!-- Scrim behind the drawer (narrow mode only) -->
    <div v-if="!isWide && drawerOpen" class="nui-scrim" @click="drawerOpen = false" />

    <aside
      class="nui-sidebar"
      :class="isWide ? { 'nui-sidebar--collapsed': !sidebarOpen } : ['nui-sidebar--drawer', { 'nui-sidebar--open': drawerOpen }]"
      data-tour="nav"
    >
      <div class="nui-sidebar-inner">
        <!-- Brand + collapse/close toggle -->
        <div class="nui-brand">
          <span class="nui-brand-text">Vinyl</span>
          <button
            class="nui-collapse-btn"
            :title="isWide ? 'Collapse sidebar' : 'Close menu'"
            @click="isWide ? (sidebarOpen = false) : (drawerOpen = false)"
          >{{ isWide ? '‹' : '✕' }}</button>
        </div>

        <!-- Nav links -->
        <nav>
          <NuxtLink
            v-for="[to, key] in nav"
            :key="to"
            :to="to"
            class="nui-nav-link"
            active-class="nui-nav-link--active"
            @click="onNavClick"
          >
            {{ t(key) }}
          </NuxtLink>
        </nav>

        <div class="nui-sep" />

        <!-- Palette picker -->
        <div class="nui-palette-list" data-tour="palette">
          <button
            v-for="p in palettes"
            :key="p.id"
            class="nui-palette-btn"
            :class="{ 'nui-palette-btn--active': palette === p.id }"
            :title="p.label"
            @click="setPalette(p.id)"
          >
            <span
              class="nui-palette-swatch"
              :style="{ background: theme.resolved.value === 'dark' ? p.accentDark : p.accent }"
            />
            <span class="nui-palette-label">{{ p.label }}</span>
          </button>
        </div>

        <!-- Spacer pushes controls to the bottom -->
        <div style="flex: 1" />

        <div class="nui-sep" />

        <!-- Controls: dark/light, language, help -->
        <div class="nui-sidebar-controls">
          <button
            class="nui-icon-btn"
            data-tour="theme"
            :title="theme.resolved.value === 'dark' ? 'Light mode' : 'Dark mode'"
            @click="theme.set(theme.resolved.value === 'dark' ? 'light' : 'dark')"
          >◐</button>
          <select
            class="nui-lang-select"
            data-tour="lang"
            :value="locale"
            @change="(e: any) => setLocale(e.target.value)"
          >
            <option value="en">EN</option>
            <option value="th">TH</option>
          </select>
          <button class="nui-icon-btn" data-tour="help" @click="restartTour">?</button>
        </div>
      </div>
    </aside>

    <div class="nui-content">
      <!-- Wide: expand tab when the rail is collapsed. Narrow: a hamburger to open the drawer. -->
      <button
        v-if="isWide && !sidebarOpen"
        class="nui-expand-btn"
        title="Expand sidebar"
        @click="sidebarOpen = true"
      >›</button>
      <button
        v-if="!isWide"
        class="nui-menu-btn"
        title="Open menu"
        aria-label="Open menu"
        @click="drawerOpen = true"
      >☰</button>

      <div class="nui-scroll-area" :class="{ 'nui-scroll-area--drawer': !isWide }">
        <slot />
      </div>
    </div>

    <TourBalloon />
  </div>
</template>

<style scoped>
/* ── Shell ─────────────────────────────────────────────────────────────────── */

.nui-shell {
  display: flex;
  height: 100dvh;
  overflow: hidden;
  background: var(--nui-bg);
  color: var(--nui-fg);
  font-family: var(--font-body);
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */

.nui-sidebar {
  width: 13rem;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--nui-bg-accent);
  border-right: var(--border-w) solid var(--hairline);
  transition: width 0.2s ease, border-color 0.2s ease;
}

.nui-sidebar--collapsed {
  width: 0;
  border-right-color: transparent;
}

/* ── Drawer mode (narrow): off-canvas overlay that slides in over the content ── */
.nui-sidebar--drawer {
  position: fixed;
  inset: 0 auto 0 0;            /* pinned to the left, full height */
  width: 14rem;
  max-width: 85vw;
  z-index: 50;
  flex-shrink: 0;
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  border-right: var(--border-w) solid var(--hairline);
}
.nui-sidebar--drawer.nui-sidebar--open {
  transform: translateX(0);
  box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.35);
}
.nui-sidebar--drawer .nui-sidebar-inner { width: 100%; }

/* Very small screens: the drawer becomes a full-width menu. */
@media (max-width: 480px) {
  .nui-sidebar--drawer { width: 100vw; max-width: 100vw; }
}

/* Scrim behind the open drawer. */
.nui-scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
}

/* Inner container — fixed width so the transition clips rather than reflows */
.nui-sidebar-inner {
  width: 13rem;
  height: 100%;
  flex-shrink: 0;
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
  overflow-y: auto;
}

/* ── Brand ────────────────────────────────────────────────────────────────── */

.nui-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.75rem;
  border-bottom: var(--border-w) solid var(--hairline);
  margin-bottom: 0.1rem;
}

.nui-brand-text {
  font-family: var(--font-brand, var(--font-display));
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 1.1rem;
  color: var(--nui-accent);
  line-height: 1;
}

.nui-collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nui-subtle);
  font-size: 1.1rem;
  padding: 0.1rem 0.25rem;
  border-radius: var(--radius-control);
  line-height: 1;
  transition: color 0.1s, background 0.1s;
  flex-shrink: 0;
}
.nui-collapse-btn:hover {
  color: var(--nui-fg);
  background: var(--nui-bg);
}

/* ── Nav links ────────────────────────────────────────────────────────────── */

.nui-sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.nui-nav-link {
  display: block;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-control);
  color: var(--nui-muted);
  text-decoration: none;
  font-size: 0.875rem;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}
.nui-nav-link:hover {
  background: var(--nui-bg);
  color: var(--nui-fg);
}
.nui-nav-link--active {
  background: var(--nui-accent);
  color: var(--nui-accent-fg);
  font-weight: 600;
}

/* ── Separator ────────────────────────────────────────────────────────────── */

.nui-sep {
  height: var(--border-w, 1px);
  background: var(--hairline);
  flex-shrink: 0;
  margin: 0.15rem 0;
}

/* ── Palette list (vertical) ──────────────────────────────────────────────── */

.nui-palette-list {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.nui-palette-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.3rem 0.6rem;
  border: var(--border-w) solid transparent;
  border-radius: var(--radius-control);
  background: none;
  color: var(--nui-muted);
  font-family: var(--font-body);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
}
.nui-palette-btn:hover {
  border-color: var(--nui-border);
  color: var(--nui-fg);
}
.nui-palette-btn--active {
  border-color: var(--nui-accent);
  color: var(--nui-fg);
  background: var(--nui-bg);
}

.nui-palette-swatch {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid var(--hairline);
}

.nui-palette-label {
  font-family: var(--font-display);
  text-transform: var(--display-transform);
  letter-spacing: var(--display-spacing);
  font-weight: var(--display-weight);
  font-size: 0.72rem;
  white-space: nowrap;
}

/* ── Sidebar controls (bottom) ────────────────────────────────────────────── */

.nui-sidebar-controls {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.nui-icon-btn {
  background: none;
  border: var(--border-w) solid var(--nui-border);
  border-radius: var(--radius-control);
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  color: var(--nui-fg);
  font-size: 0.875rem;
  line-height: 1.4;
  transition: background 0.1s;
  white-space: nowrap;
}
.nui-icon-btn:hover {
  background: var(--nui-bg);
}

.nui-lang-select {
  font-size: 0.75rem;
  padding: 0.2rem 0.35rem;
  border: var(--border-w) solid var(--nui-border);
  border-radius: var(--radius-control);
  background: var(--nui-bg);
  color: var(--nui-fg);
  font-family: var(--font-body);
  cursor: pointer;
}

/* ── Content area ─────────────────────────────────────────────────────────── */

.nui-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.nui-scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ── Expand tab (when sidebar is collapsed) ───────────────────────────────── */

.nui-expand-btn {
  position: absolute;
  top: 0.75rem;
  left: 0;
  z-index: 20;
  background: var(--nui-bg-accent);
  border: var(--border-w) solid var(--hairline);
  border-left: none;
  border-radius: 0 var(--radius-control) var(--radius-control) 0;
  cursor: pointer;
  color: var(--nui-muted);
  font-size: 1rem;
  padding: 0.3rem 0.4rem 0.3rem 0.25rem;
  line-height: 1;
  transition: color 0.1s, background 0.1s;
}
.nui-expand-btn:hover {
  color: var(--nui-fg);
  background: var(--nui-bg);
}

/* ── Hamburger (narrow mode) ──────────────────────────────────────────────── */
.nui-menu-btn {
  position: absolute;
  top: 0.5rem;
  left: 0.6rem;
  z-index: 20;
  background: var(--nui-bg-accent);
  border: var(--border-w) solid var(--hairline);
  border-radius: var(--radius-control);
  cursor: pointer;
  color: var(--nui-fg);
  font-size: 1.05rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
  transition: color 0.1s, background 0.1s;
}
.nui-menu-btn:hover { background: var(--nui-bg); }

/* Reserve a top gutter for the hamburger so it never overlaps the page toolbar. */
.nui-scroll-area--drawer { padding-top: 2.6rem; }
</style>
