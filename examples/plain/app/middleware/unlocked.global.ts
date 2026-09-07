export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/') return
  const { vault } = useVault()
  if (!vault.value) return navigateTo({ path: '/', query: { redirect: to.fullPath } })
})
