---
name: nuxt-auth-utils
description: "nuxt-auth-utils conventions for bigin Nuxt v4 projects — session management, OAuth providers, password hashing, and WebAuthn. Use when implementing login, registration, protected routes, or any auth flow."
---

# nuxt-auth-utils — Authentication for Nuxt

`nuxt-auth-utils` adds secure, sealed cookie-based sessions to Nuxt. Requires `nuxt build` (server API routes must be available — do **not** use with `nuxt generate`).

---

## Installation

```bash
npx nuxi@latest module add auth-utils
```

Add to `.env`:

```
NUXT_SESSION_PASSWORD=password-with-at-least-32-characters
```

> The module auto-generates one in dev if missing, but always set it explicitly in production.

---

## nuxt.config.ts

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 7, // 1 week
    },
    oauth: {
      github: {
        clientId: '',
        clientSecret: '',
      },
    },
  },
})
```

OAuth credentials are set via env vars: `NUXT_OAUTH_GITHUB_CLIENT_ID`, `NUXT_OAUTH_GITHUB_CLIENT_SECRET`.

---

## Type Augmentation

Always declare your session shape:

```typescript
// shared/types/auth.d.ts
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
  }

  interface UserSession {
    loggedInAt: number
  }

  interface SecureSessionData {
    // server-only fields (not exposed to client)
  }
}

export {}
```

---

## Server Utils (auto-imported in `server/`)

```typescript
// Set session (merges with existing data)
await setUserSession(event, {
  user: { id: 'abc', email: 'user@example.com', name: 'Alice' },
  loggedInAt: Date.now(),
})

// Get session
const session = await getUserSession(event)

// Require session (throws 401 if no user)
const session = await requireUserSession(event)

// Clear session (logout)
await clearUserSession(event)

// Replace session (no merge)
await replaceUserSession(event, data)
```

---

## Vue Composable

```vue
<script setup>
const { loggedIn, user, session, fetch, clear } = useUserSession()
</script>

<template>
  <div v-if="loggedIn">
    <p>Hello {{ user.name }}</p>
    <button @click="clear">Logout</button>
  </div>
  <div v-else>
    <a href="/auth/github">Login with GitHub</a>
  </div>
</template>
```

Use `<AuthState>` to safely handle auth state in cached/prerendered pages:

```vue
<template>
  <header>
    <AuthState v-slot="{ loggedIn, clear }">
      <button v-if="loggedIn" @click="clear">Logout</button>
      <NuxtLink v-else to="/login">Login</NuxtLink>
    </AuthState>
  </header>
</template>
```

---

## OAuth Providers

Over 40 providers supported. Pattern: `defineOAuth<Provider>EventHandler`.

```typescript
// server/routes/auth/github.get.ts
export default defineOAuthGitHubEventHandler({
  config: {
    emailRequired: true,
  },
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
      },
      loggedInAt: Date.now(),
    })
    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/login')
  },
})
```

Set callback URL in your OAuth app: `<your-domain>/auth/github`.

Common providers: `GitHub`, `Google`, `Discord`, `Microsoft`, `LinkedIn`, `Apple`, `Spotify`, `Twitter/X`.

---

## Password Hashing

Uses `scrypt` — works in Node, Deno, and Cloudflare Workers.

```typescript
// Hash on registration
const hashedPassword = await hashPassword(plainPassword)

// Verify on login
const valid = await verifyPassword(hashedPassword, plainPassword)
if (!valid) throw createError({ statusCode: 401, message: 'Invalid credentials' })

// Check if rehash needed (e.g. after changing cost params)
if (passwordNeedsRehash(hashedPassword)) {
  hashedPassword = await hashPassword(plainPassword)
}
```

Configure scrypt cost in `nuxt.config.ts`:

```typescript
auth: {
  hash: {
    scrypt: {
      // costFactor, blockSize, parallelization, etc.
    }
  }
}
```

---

## Protected API Routes

```typescript
// server/api/profile.get.ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event) // throws 401 if not authed
  return { profile: user }
})
```

```typescript
// server/middleware/auth.ts — protect all /api/admin/* routes
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/admin')) {
    await requireUserSession(event)
  }
})
```

---

## Session Hooks

```typescript
// server/plugins/session.ts
export default defineNitroPlugin(() => {
  // Runs on /api/_auth/session fetch — extend or validate session
  sessionHooks.hook('fetch', async (session, event) => {
    // e.g. refresh user data from DB
  })

  // Runs on clear — use for audit logging
  sessionHooks.hook('clear', async (session, event) => {
    console.log('User logged out:', session.user?.id)
  })
})
```

---

## Hybrid Rendering

When using `routeRules` to prerender pages, session is fetched client-side after hydration (not during prerender). For pages that must show auth state correctly in prerender, use `<AuthState>`.

For fully client-side session loading:

```typescript
// nuxt.config.ts
auth: {
  loadStrategy: 'client-only'
}
```

---

## Cookie Limit

Session data is encrypted and stored in a cookie — **4096 byte limit**. Store only IDs and essential flags in the session; fetch full user data via `sessionHooks.hook('fetch')` from your DB.

---

## WebAuthn (Passkeys)

Install peer deps:

```bash
pnpm add @simplewebauthn/server@11 @simplewebauthn/browser@11
```

Enable:

```typescript
// nuxt.config.ts
auth: {
  webAuthn: true
}
```

Server handlers: `defineWebAuthnRegisterEventHandler`, `defineWebAuthnAuthenticateEventHandler`.

Client composable: `useWebAuthn({ registerEndpoint, authenticateEndpoint })`.

Requires a `credentials` table in your DB — see drizzle skill for schema conventions.

---

## Common Patterns

### Login with email + password

```typescript
// server/api/auth/login.post.ts
export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)
  const db = useDB(event.context.cloudflare.env)

  const user = await db.select().from(schema.users)
    .where(eq(schema.users.email, email)).get()

  if (!user || !await verifyPassword(user.passwordHash, password))
    throw createError({ statusCode: 401, message: 'Invalid credentials' })

  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
```

### Logout

```typescript
// server/api/auth/logout.post.ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
```

### Registration

```typescript
// server/api/auth/register.post.ts
export default defineEventHandler(async (event) => {
  const { email, password, name } = await readBody(event)
  const db = useDB(event.context.cloudflare.env)

  const existing = await db.select().from(schema.users)
    .where(eq(schema.users.email, email)).get()
  if (existing) throw createError({ statusCode: 409, message: 'Email already in use' })

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  await db.insert(schema.users).values({ id, email, name, passwordHash })

  await setUserSession(event, {
    user: { id, email, name },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `NUXT_SESSION_PASSWORD must be at least 32 chars` | Set a long random string in `.env` |
| Session lost on redeploy | Ensure `NUXT_SESSION_PASSWORD` is consistent across deploys |
| OAuth callback URL mismatch | Set `NUXT_OAUTH_<PROVIDER>_REDIRECT_URL` explicitly |
| `requireUserSession` throwing in prerendered page | Use `loadStrategy: 'client-only'` or move check to API route |
| Cookie too large | Store only IDs in session; load full data in `sessionHooks.hook('fetch')` |
