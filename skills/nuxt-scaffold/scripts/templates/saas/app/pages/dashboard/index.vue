<script setup lang="ts">
definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Dashboard'
})

const { user, logout } = useAuth()

async function onLogout() {
  // DELETE /api/v1/auth/session: the API drops the session and clears its cookie.
  await logout()
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
          The API owns the session: login and sign-out are POST/DELETE /api/v1/auth/session
          (app/composables/useAuth.ts), the session is an HttpOnly cookie this code can't read, and
          every call goes through the same-origin /api pass-through.
        </p>
      </UPageCard>
    </UContainer>
  </div>
</template>
