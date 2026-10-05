---
name: nuxt-marketing-scaffold
description: "Scaffolds a new multi-locale Nuxt 4 marketing site from scratch (no nuxt.config.ts yet) — @nuxt/content, @nuxtjs/i18n, Cloudflare Workers; no auth, no BFF. Triggers: 'scaffold a marketing site', 'new multi-locale nuxt site'."
argument-hint: [project name]
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# nuxt-marketing-scaffold

Creates the app the `nuxt-marketing` harness profile onboards. One deterministic
script, no prompts: every decision arrives as a CLI flag.

## When this runs

Phase 0.5 of `bigin-harness-setup` delegates here when `PROFILE = nuxt-marketing`
and the repo has no `nuxt.config.ts` — the same shape as `nuxt` → `nuxt-scaffold`.
A marketing site that already exists skips this entirely and is onboarded by its
markers.

Never substitute `nuxt-scaffold`: it installs an auth dependency, so the site would
detect as `nuxt` on the next harness run and get BFF conventions it does not have.

## Step 1 — gather

| Decision | Flag | Default |
|---|---|---|
| project name (kebab-case) | `--project` | *required* |
| target directory | `--dir` | the project name |
| locales, first is the default | `--locales` | `en,vi` |
| primary theme colour | `--primary` | `blue` |
| neutral theme colour | `--neutral` | `slate` |

## Step 2 — run

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs \
  --project acme-site --dir . --locales en,vi --primary blue --neutral slate
```

`--no-install` skips the `pnpm install` step; `--no-commit` skips `git init` and
the initial commit; `--force` allows a non-empty target.

The install is `pnpm install` against the manifest the template writes, never
`pnpm add <names>`. `pnpm add` re-resolves every name to whatever is latest that
morning and overwrites the pinned ranges, which would mean the installed tree
and the `--no-install` tree are two different dependency sets — and only one of
them was ever built.

## What it writes

```
nuxt.config.ts          i18n with NO fallbackLocale, cloudflare_module preset,
                        one prerender entry point per locale, empty runtimeConfig
content.config.ts       one `pages` collection, schema-validated
content.schema.ts       the collection schema + the block-type list, exported
                        so a test can import it without a Nuxt build
content/<locale>/       one index.md per locale
i18n/locales/<code>.json
app/app.vue             UApp > NuxtLayout > NuxtPage
app/app.config.ts       where --primary and --neutral land
app/assets/css/main.css the Tailwind + @nuxt/ui entry point
app/pages/[...slug].vue the only place queryCollection() is called
app/utils/blockFor.ts   block type -> component, unknown types render nothing
app/components/blocks/  blocks take props and never query
server/api/             exactly contact.post.ts and newsletter.post.ts
server/utils/           their Turnstile, rate-limit and delivery helpers
tsconfig.json           project references onto the four .nuxt/tsconfig.*.json
eslint.config.mjs       withNuxt() over the generated flat config
vitest.config.ts        include scoped to tests/**, `~~` and `~` aliases
tests/                  seed tests: the collection schema, the Hero block by
                        props, the block registry, and the locale bundles
wrangler.jsonc          one Worker per site
```

`tests/` mirrors the source tree and is never co-located with it — the rule the
profile's `testing.md` states, and the reason `vitest.config.ts` scopes
`test.include` to `tests/**/*.test.ts`. The four seeds are not a suite: they
exist so `pnpm test --run` — the command both CI templates run — has something
real to run on the first push, and so the next test written has a shape to copy.

## The form routes fail loudly, and that is the design

Both routes validate their payload with zod, verify Turnstile and rate-limit
before they do anything else. All three of those need something the scaffolder
cannot know, and every one of them refuses rather than degrading:

| Helper | Needs | Unconfigured behaviour |
|---|---|---|
| `verifyTurnstile` | `NUXT_TURNSTILE_SECRET_KEY` | 503 `TURNSTILE_SECRET_MISSING` |
| `rateLimit` | a `RATE_LIMIT` KV binding | 503 `RATE_LIMIT_BINDING_MISSING` |
| `deliverContactMessage` | `NUXT_CONTACT_DELIVERY_URL` | 501 `CONTACT_DELIVERY_NOT_CONFIGURED` |
| `subscribe` | `NUXT_NEWSLETTER_DELIVERY_URL` | 501 `NEWSLETTER_DELIVERY_NOT_CONFIGURED` |

A rate limiter that allows the request when its store is missing, or a delivery
seam that returns `{ ok: true }` into a void, is worse than a route that is
plainly broken: nobody finds out until a client asks why nobody replied. No
secret value is ever written into a template — `nuxt.config.ts` declares the
keys empty and the environment supplies them.

Maintainer notes (design rationale, manual validation after changing the script or templates) live in `references/MAINTAINING.md`. A scaffold run never needs them, so it never reads them.
