<script setup lang="ts">
definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Dashboard'
})

const { user, fetch: refreshSession } = useUserSession()

async function onLogout() {
  // Hit the BFF logout route (revokes the refresh token on the backend, then
  // clears the sealed cookie) rather than clearing the client session alone.
  await $fetch('/api/logout', { method: 'POST' })
  await refreshSession()
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-default flex items-center justify-between px-6 py-4">
      <AppLogo />
      <UButton
        label="Sign out"
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        @click="onLogout"
      />
    </header>

    <UContainer class="py-12">
      <UPageCard
        title="Welcome back"
        :description="`Signed in as ${user?.email}`"
        icon="i-lucide-layout-dashboard"
      >
        <p class="text-muted">
          This is a private area — only reachable when logged in (see app/middleware/auth.global.ts).
          Login/signup call the paired backend (server/api/login.post.ts, signup.post.ts) and store the
          token pair in the session's server-only `secure` key; browser data calls go through the
          same-origin BFF proxy at /api/backend/*.
        </p>
      </UPageCard>
    </UContainer>
  </div>
</template>
