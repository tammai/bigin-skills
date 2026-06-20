# SPA Frontend Stack Spec
# Đặc tả stack SPA Frontend

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt v4, SSR disabled (`ssr: false`) |
| UI Library | Nuxt UI (latest) |
| CSS | Tailwind CSS v4 |
| Font | Google Sans (via `@theme static --font-sans`, no CDN import) |
| Theme Primary | Blue |
| Theme Neutral | Slate |
| State | Pinia + Pinia Colada |
| Utilities | VueUse |
| Rendering | Client-side only (SPA) |

No server-side rendering. No Nitro presets. No Cloudflare services.  
*Không có server-side rendering. Không dùng Nitro preset. Không có Cloudflare services.*

---

## nuxt.config.ts (canonical baseline)

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: false },

  ssr: false,

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

> No Google Fonts CDN import — `--font-sans` in `@theme static` registers Google Sans as the default font via Tailwind CSS v4.

---

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
    "typescript": "latest",
    "vitest": "latest",
    "vue-tsc": "latest"
  }
}
```

`nuxt build` with `ssr: false` produces a client-only SPA in `.output/public/`. Use `nuxt build` (not `nuxt generate`) in CI/CD scripts — both fullstack and SPA use the same build command. Deploy to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

---

## Pinia Store Conventions

```typescript
// stores/useCounterStore.ts
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const increment = () => count.value++
  return { count, increment }
})
```

- Stores live in `app/stores/`
- Use Composition API style (not Options API)
- One store per domain concept

---

## Pinia Colada (Data Fetching)

Use Pinia Colada for async data fetching instead of `useFetch` or `useAsyncData` in SPA mode:

```typescript
// composables/useUsers.ts
import { useQuery } from '@pinia/colada'

export const useUsers = () => useQuery({
  key: ['users'],
  query: () => $fetch('/api/users'),
})
```

---

## VueUse Conventions

- Import from `@vueuse/core`
- Prefer VueUse composables over manual DOM/event code
- Common uses: `useLocalStorage`, `useDark`, `useMediaQuery`, `useDebounce`, `useThrottleFn`

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
├── public/
├── nuxt.config.ts
├── app.config.ts
└── package.json
```

---

## API Integration

Since this is a pure SPA, all data comes from external APIs. Use `$fetch` or Pinia Colada queries:

```typescript
// Direct fetch
const data = await $fetch('https://api.example.com/resource')

// With Pinia Colada (preferred for reactive, cached data)
const { data, status } = useQuery({
  key: ['resource', id],
  query: () => $fetch(`https://api.example.com/resource/${id}`),
})
```

Set `NUXT_PUBLIC_API_URL` in `.env` for the API base URL:

```typescript
// nuxt.config.ts
runtimeConfig: {
  public: {
    apiBase: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
}
```
