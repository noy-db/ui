export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/') return
  const { vault } = useVault()
  // Locked (e.g. a cmd-clicked tab has its own empty session-only vault): send to unlock, but
  // remember the deep link (record + ?q=) so P-C's fork can restore it after unlocking.
  if (!vault.value) return navigateTo({ path: '/', query: { redirect: to.fullPath } })
})
