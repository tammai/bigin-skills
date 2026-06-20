# Fullstack MVP Stack Spec
# Đặc tả stack Fullstack MVP

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt v4 |
| UI Library | Nuxt UI (latest) |
| CSS | Tailwind CSS v4 |
| Font | Google Sans (via `@theme static --font-sans`, no CDN import) |
| Theme Primary | Blue |
| Theme Neutral | Slate |
| State | Pinia + Pinia Colada |
| Utilities | VueUse |
| Runtime | Nitro (cloudflare-pages preset) |
| Deployment | Cloudflare Pages |
| Config | Wrangler (manual, wrangler.toml) |
| Local Dev | nitro-cloudflare-dev |

## Optional Cloudflare Services

| Service | Binding Name | When to Enable |
|---------|-------------|----------------|
| D1 (SQLite) | `DB` | Needs persistent relational data |
| R2 (Object Storage) | `STORAGE` | Needs file/asset uploads |
| KV (Key-Value) | `KV` | Needs cache, sessions, or config store |

Ask the user which optional services to enable during Phase 3.

---

## nuxt.config.ts (canonical baseline)

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: false },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@pinia/colada-nuxt',
    '@vueuse/nuxt',
  ],

  ui: {
    theme: {
      colors: ['primary', 'error'],
    },
  },

  ssr: false,

  nitro: {
    preset: 'cloudflare-pages',
  },

  css: ['~/assets/css/main.css'],
})
```

## app.config.ts (canonical baseline)

```typescript
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate',
    },
  },
})
```

## assets/css/main.css

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: 'Google Sans', sans-serif;

  --ui-container: 90rem;
}

@layer base {
  body {
    background-color: var(--ui-bg-muted);
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: var(--ui-color-neutral-300) transparent;
  }

  *::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background-color: var(--ui-color-neutral-300);
    border-radius: 9999px;
  }

  .dark *::-webkit-scrollbar-thumb {
    background-color: var(--ui-color-neutral-600);
  }
}

@layer utilities {
  .heading-1 {
    font-size: 2.25rem;
    line-height: 2.5rem;
    font-weight: 700;
    letter-spacing: -0.025em;
  }

  .heading-2 {
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 600;
    letter-spacing: -0.015em;
  }

  .heading-3 {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .heading-4 {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 500;
  }
}
```

> No Google Fonts CDN import — `--font-sans` in `@theme static` registers Google Sans as the default font via Tailwind CSS v4. Google Sans is expected to be available via the OS or deployment environment.

---

## wrangler.toml (manual config)

```toml
name = "your-app-name"
compatibility_date = "2025-01-01"
pages_build_output_dir = ".output/public"

# Uncomment as needed:

# [[d1_databases]]
# binding = "DB"
# database_name = "your-db-name"
# database_id = "YOUR_DATABASE_ID"

# [[r2_buckets]]
# binding = "STORAGE"
# bucket_name = "your-bucket-name"

# [[kv_namespaces]]
# binding = "KV"
# id = "YOUR_KV_NAMESPACE_ID"
```

## package.json

```json
{
  "name": "my-app",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "vue-tsc --noEmit",
    "deploy": "wrangler pages deploy .output/public",
    "cf-dev": "nitro-cloudflare-dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@nuxt/ui": "latest",
    "@pinia/colada": "latest",
    "@pinia/colada-nuxt": "latest",
    "@pinia/nuxt": "latest",
    "@vueuse/nuxt": "latest",
    "nuxt": "latest",
    "nuxt-auth-utils": "latest",
    "pinia": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@nuxt/devtools": "latest",
    "@nuxt/eslint": "latest",
    "eslint": "latest",
    "@nuxt/test-utils": "latest",
    "@vitest/coverage-v8": "latest",
    "@vue/test-utils": "latest",
    "happy-dom": "latest",
    "nitro-cloudflare-dev": "latest",
    "typescript": "latest",
    "vitest": "latest",
    "vue-tsc": "latest",
    "wrangler": "latest"
  }
}
```

---

## Nitro API Routes

API routes live in `server/api/`. Example:

```typescript
// server/api/hello.get.ts
export default defineEventHandler(async (event) => {
  const { DB } = event.context.cloudflare.env  // D1 binding
  return { message: 'hello' }
})
```

Bindings are accessed via `event.context.cloudflare.env`.

---

## D1 Conventions (if enabled)

- Schema files in `server/database/schema.sql`
- Migrations in `server/database/migrations/`
- Seed files in `server/database/seed.sql`
- Use `drizzle-orm` with `drizzle-orm/d1` driver (preferred) or raw `env.DB.prepare()`
- All table names: snake_case
- Primary keys: `id INTEGER PRIMARY KEY AUTOINCREMENT`

---

## R2 Conventions (if enabled)

- Upload via `event.context.cloudflare.env.STORAGE.put(key, body)`
- Public URLs via Cloudflare R2 public bucket or custom domain
- Key naming: `{type}/{uuid}.{ext}` (e.g. `avatars/abc123.jpg`)

---

## KV Conventions (if enabled)

- Access via `event.context.cloudflare.env.KV.get(key)` / `.put(key, value)`
- Use for: session tokens, feature flags, rate limit counters, cached responses
- TTL on all temporary keys

---

## Local Dev with nitro-cloudflare-dev

```bash
# Install
npm install -D nitro-cloudflare-dev

# Run (simulates Cloudflare bindings locally)
npm run cf-dev
```

`nitro-cloudflare-dev` reads `wrangler.toml` and injects local D1/R2/KV simulators.  
Local D1 data lives in `.wrangler/state/`.

---

## Deploy

```bash
# Build
npm run build

# Deploy to Cloudflare Pages
npm run deploy

# First-time setup (create project in Cloudflare):
wrangler pages project create your-app-name
```

---

## Folder Structure

```
project/
├── app/
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   ├── pages/
│   ├── stores/          ← Pinia stores
│   └── assets/
│       └── css/
│           └── main.css
├── server/
│   ├── api/
│   ├── middleware/
│   └── database/
│       ├── schema.sql
│       └── migrations/
├── public/
├── nuxt.config.ts
├── app.config.ts
├── wrangler.toml
└── package.json
```
