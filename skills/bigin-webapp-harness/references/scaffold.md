# Project Scaffold Templates

# Mẫu khởi tạo dự án

Scaffold uses the official `nuxi init` command for Nuxt projects (Types 1 & 2), then adds packages and writes config files on top. Go projects (Type 3) are still file-written verbatim.

_Nuxt project scaffold dùng lệnh `nuxi init` chính thức, sau đó thêm packages và ghi config. Go project vẫn ghi file trực tiếp._

---

## Detection — Is the repo empty?

Check for any of these files. If **none** exist, the repo is empty and needs scaffolding:

- `package.json`
- `nuxt.config.ts`
- `go.mod`

If any exist, skip scaffold entirely — assume the project is already bootstrapped.

---

## Customization Prompt (Nuxt types only)

## Hỏi tùy chỉnh (chỉ cho Nuxt)

Ask the user these questions **before running any commands**:

```
Before I scaffold, a few quick questions:

1. App name? (default: current folder name)
2. Primary color? (default: blue)
   Options: red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose
3. Neutral color? (default: slate)
   Options: slate, gray, zinc, neutral, stone
4. Font family? (default: Google Sans)
```

Capture the answers as: `{app-name}`, `{primary}`, `{neutral}`, `{font}`. Use the defaults for anything the user skips.

---

## Type 1: Fullstack MVP (Nuxt v4 + Cloudflare Pages)

### Step 1 — Init from Nuxt UI template

Run this command non-interactively (no TTY in Claude's bash context):

```bash
pnpm create nuxt@latest . --template ui --packageManager pnpm --no-gitInit --no-install
```

This creates the base Nuxt + Nuxt UI project without running `pnpm install`.

> **If `--no-gitInit` is not accepted:** try `--gitInit=false`. If nuxi still errors on missing `gitInit` arg, pass `--gitInit=false` explicitly.

### Step 2 — Update `package.json`

Merge these fields into the generated `package.json` (do not replace the whole file — add/overwrite only these keys):

**scripts:**

```json
{
  "build": "NUXT_DEVTOOLS_ENABLED=false nuxt build",
  "dev": "nuxt dev",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",
  "lint": "eslint .",
  "typecheck": "nuxt typecheck",
  "test:unit": "vitest run",
  "test:unit:watch": "vitest",
  "cf:types": "wrangler types",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "wrangler d1 migrations apply {app-name}-db --local",
  "db:studio": "drizzle-kit studio"
}
```

> If D1 is NOT enabled, omit `db:generate`, `db:migrate`, `db:studio`.
> **Substitute `{app-name}` in `db:migrate`** before writing — use the actual app name collected in the customization prompt (e.g. `wrangler d1 migrations apply my-project-db --local`).

**dependencies to add** (merge into existing `dependencies`):

```json
{
  "@pinia/nuxt": "latest",
  "@pinia/colada-nuxt": "latest",
  "@vueuse/nuxt": "latest",
  "drizzle-orm": "latest",
  "zod": "latest"
}
```

> If D1 is NOT enabled, omit `drizzle-orm`.
> If auth is enabled, also add `"nuxt-auth-utils": "latest"`.

**devDependencies to add** (merge into existing `devDependencies`):

```json
{
  "@nuxt/eslint": "latest",
  "@cloudflare/workers-types": "latest",
  "wrangler": "latest",
  "nitro-cloudflare-dev": "latest",
  "drizzle-kit": "latest",
  "@nuxt/test-utils": "latest",
  "vitest": "latest",
  "@vitest/coverage-v8": "latest",
  "@vue/test-utils": "latest",
  "happy-dom": "latest",
  "simple-git-hooks": "latest",
  "lint-staged": "latest"
}
```

> If D1 is NOT enabled, omit `drizzle-kit`.

**top-level fields to add:**

```json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged"
  },
  "lint-staged": {
    "*.{ts,vue,js,mjs}": "eslint --fix"
  }
}
```

### Step 3 — Write config files

Write or overwrite each file below. If the file already exists from nuxi init, replace it.

#### `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@pinia/colada-nuxt',
    // 'nuxt-auth-utils',
  ],

  ssr: false,

  devtools: false,

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'cloudflare-pages',
    modules: ['nitro-cloudflare-dev'],
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
});
```

> Uncomment `nuxt-auth-utils` if auth is enabled.

#### `app/app.config.ts`

```typescript
export default defineAppConfig({
  ui: {
    colors: {
      primary: '{primary}',
      neutral: '{neutral}',
    },
    theme: {
      defaultVariants: {
        size: 'lg',
      },
    },
  },
});
```

#### `app/assets/css/main.css`

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme static {
  --font-sans: '{font}', sans-serif;

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

> `{font}` is the font family from the customization prompt (e.g. `Google Sans`). Google Sans is expected to be available via OS/CDN — no `@import` needed; `@theme static` registers it as the default sans-serif through Tailwind v4.

#### `eslint.config.mjs`

```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt();
// Add custom rules here
```

#### `app/app.vue`

```vue
<script setup>
useHead({ htmlAttrs: { lang: 'en' } });
useSeoMeta({ title: '{app-name}' });
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

#### `app/layouts/default.vue`

```vue
<template>
  <div class="min-h-screen">
    <slot />
  </div>
</template>
```

#### `app/pages/index.vue`

```vue
<template>
  <UContainer class="py-16">
    <h1 class="heading-1 text-highlighted">{app-name}</h1>
  </UContainer>
</template>
```

#### `vitest.config.ts`

```typescript
import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
      },
    },
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

#### `.vscode/settings.json`

```json
{
  "prettier.enable": false,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "dbaeumer.vscode-eslint",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

#### `.editorconfig`

```ini
root = true

[*]
indent_size = 2
indent_style = space
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

#### `wrangler.toml`

```toml
name = "{app-name}"
compatibility_date = "2025-01-15"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".output/public"

# Uncomment as needed:

# [[d1_databases]]
# binding = "DB"
# database_name = "{app-name}-db"
# database_id = "YOUR_D1_DATABASE_ID"
# preview_database_id = "DB"
# migrations_dir = "server/database/migrations"

# [[kv_namespaces]]
# binding = "KV"
# id = "YOUR_KV_NAMESPACE_ID"
# preview_id = "KV"

# [[r2_buckets]]
# binding = "STORAGE"
# bucket_name = "{app-name}-storage"
```

#### `.env.example`

```
# Cloudflare bindings are configured in wrangler.toml
# Local secrets:
# NUXT_SESSION_PASSWORD=your-secret-here
```

#### `.claude/settings.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // empty' | { read -r f; [[ \"$f\" =~ \\.(vue|ts|js|mjs)$ ]] && pnpm eslint --fix \"$f\"; } 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

### Step 4 — Create directories

Create these empty directories with a `.gitkeep` placeholder:

```
app/components/
app/composables/
app/stores/
server/api/
server/middleware/
server/database/migrations/   ← only if D1 enabled
tests/unit/
public/
```

### Step 5 — Run pnpm install

```bash
pnpm install
```

### Step 6 — Announce

```
✅ Fullstack MVP scaffolded:
  nuxi init (Nuxt UI template) →
  package.json updated →
  config files written →
  pnpm install done

Stack: Nuxt v4, Nuxt UI, Pinia, Pinia Colada, VueUse, Zod, Drizzle ORM, Cloudflare Pages
Dev: pnpm dev  |  With CF bindings: pnpm cf:types && pnpm dev

Now generating your agent team...
```

---

## Type 2: SPA Frontend (Nuxt v4, SSR false)

Same flow as Type 1 with these differences:

### Step 1 — Same nuxi init command

```bash
pnpm create nuxt@latest . --template ui --packageManager pnpm --no-gitInit --no-install
```

### Step 2 — package.json differences

**scripts** — omit all `cf:types`, `db:*` entries. Keep:

```json
{
  "build": "NUXT_DEVTOOLS_ENABLED=false nuxt build",
  "dev": "nuxt dev",
  "preview": "nuxt preview",
  "postinstall": "nuxt prepare",
  "lint": "eslint .",
  "typecheck": "nuxt typecheck",
  "test:unit": "vitest run",
  "test:unit:watch": "vitest"
}
```

**dependencies** — omit `drizzle-orm`; no Cloudflare packages:

```json
{
  "@pinia/nuxt": "latest",
  "@pinia/colada-nuxt": "latest",
  "@vueuse/nuxt": "latest",
  "zod": "latest"
}
```

> Add `"nuxt-auth-utils": "latest"` if auth enabled.

**devDependencies** — omit `@cloudflare/workers-types`, `wrangler`, `nitro-cloudflare-dev`, `drizzle-kit`:

```json
{
  "@nuxt/eslint": "latest",
  "@nuxt/test-utils": "latest",
  "vitest": "latest",
  "@vitest/coverage-v8": "latest",
  "@vue/test-utils": "latest",
  "happy-dom": "latest",
  "simple-git-hooks": "latest",
  "lint-staged": "latest"
}
```

### Step 3 — Config file differences

#### `nuxt.config.ts` (SPA — no nitro preset)

```typescript
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@pinia/colada-nuxt',
    // 'nuxt-auth-utils',
  ],

  ssr: false,

  devtools: false,

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_URL,
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
});
```

#### `.env.example` (SPA)

```
NUXT_PUBLIC_API_URL=http://localhost:8080
```

All other config files (`app.config.ts`, `main.css`, `app.vue`, `layouts/default.vue`, `pages/index.vue`, `vitest.config.ts`, `.vscode/settings.json`, `.editorconfig`, `.claude/settings.json`) are **identical to Type 1** — skip `wrangler.toml`.

### Step 4 — Directories (no server/ or migrations/)

```
app/components/
app/composables/
app/stores/
tests/unit/
public/
```

### Step 5 — pnpm install

```bash
pnpm install
```

### Step 6 — Announce

```
✅ SPA Frontend scaffolded.

Stack: Nuxt v4 (SSR off), Nuxt UI, Pinia, Pinia Colada, VueUse, Zod
Dev: pnpm dev

Now generating your agent team...
```

---

## Type 3: Backend (Go)

### Files to create

#### `go.mod` (replace `your-module-name` with actual name)

```
module your-module-name

go 1.23
```

#### `cmd/server/main.go`

```go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default() // Logger + Recovery middleware

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
```

#### `Makefile`

```makefile
.PHONY: run build test tidy

run:
	go run ./cmd/server

build:
	go build -o bin/server ./cmd/server

test:
	go test ./...

tidy:
	go mod tidy
```

#### `.gitignore`

```
bin/
*.env
.env.*
!.env.example
```

#### `.env.example`

```
PORT=8080
```

### Directories to create (empty, add `.gitkeep`)

```
cmd/server/
internal/
  handler/
  middleware/
  service/
  repository/
  model/
```

### After scaffold — tell the user:

```
✅ Go Backend scaffolded.

  go mod tidy
  make run

Now generating your agent team...
```

---

## Scaffold Rules

1. **Run `pnpm install` automatically** (Nuxt types) — the project is ready to develop immediately after scaffold
2. **Never overwrite an existing file unless the scaffold explicitly says to replace it** — nuxi init files that we write over are always replaced intentionally
3. **Ask customization questions first, before any commands** — collect `{app-name}`, `{primary}`, `{neutral}`, `{font}` before running nuxi init
4. **Go Backend: no package manager install** — write files only, user runs `go mod tidy` manually
5. **Announce what was done** — list key files written and the dev command before moving to Phase 4
