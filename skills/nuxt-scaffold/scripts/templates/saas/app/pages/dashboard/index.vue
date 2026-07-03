<script setup lang="ts">
definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Dashboard'
})

const { user, clear } = useUserSession()

async function onLogout() {
  await clear()
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
          Auth here is a demo stand-in with no backend wired; swap server/api/login.post.ts and
          server/api/signup.post.ts for real calls before shipping.
        </p>
      </UPageCard>
    </UContainer>
  </div>
</template>
