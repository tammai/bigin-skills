---
name: nuxt-marketing-scaffold
description: Scaffolds a new multi-locale Nuxt 4 marketing site from scratch — empty repo or no nuxt.config.ts. @nuxt/content collections, @nuxtjs/i18n, Tailwind, prerendered to Cloudflare Workers; no auth and no BFF. Triggers: 'scaffold a marketing site', 'new multi-locale nuxt site', 'create a content site'.
---

# nuxt-marketing-scaffold

Creates the app the `nuxt-marketing` harness profile onboards. One deterministic
script, no prompts: every decision arrives as a CLI flag.

## When this runs

Phase 0.5 of `bigin-harness-setup` delegates here when `PROFILE = nuxt-marketing`
and the repo has no `nuxt.config.ts` — the same shape as `nuxt` → `nuxt-scaffold`.
A marketing site that already exists skips this entirely and is onboarded by its
markers.

## Why this is not a `nuxt-scaffold` template

`nuxt-scaffold` installs `nuxt-auth-utils` into every project it creates. That is
exactly the auth marker condition 4 of the `nuxt-marketing` detection rung tests
for, so a marketing site scaffolded through it resolves to `nuxt` on the next run
and gets BFF-proxy and Pinia-Colada conventions written into a site that has
neither — the failure the profile exists to prevent, and one that looks like
success at install time.

**Do not merge the two scaffolders.** The separation is the safeguard.

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
wrangler.jsonc          one Worker per site
```

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

## The four things the layout guarantees

1. `@nuxt/content` **and** `@nuxtjs/i18n` land in `dependencies`, never
   `devDependencies` — conditions 2 and 3 of the detection rung.
2. No auth dependency of any kind — condition 4.
3. `server/api/` holds the two form routes and nothing else. The rung
   deliberately does not test for that directory, precisely so a site keeps
   detecting once it grows a contact form.
4. No `fallbackLocale` anywhere: a missing locale renders nothing rather than
   shipping untranslated copy. The profile's pre-commit gate greps for it.

## Verifying a change to this skill

Detection alone is not enough, and assuming it was is how four build-breaking
defects shipped green in v1.88.0: the suite scaffolded a site, checked that it
*detected* as `nuxt-marketing`, and never checked that it compiled.

- `node tools/regress.mjs` — the structural cases. Fast, always on, run by the
  commit hook. They catch an unsubstituted token, a flag that never reaches the
  generated file, an import of a package no manifest declares, and a helper
  nothing defines.
- `node tools/regress.mjs --build` — really installs and builds a three-locale
  scaffold and asserts one prerendered entry point per locale. Slow and
  network-bound, so it is opt-in; run it for any change to a template, the
  manifest or the substitution map.
- `bigin-harness-setup`'s Phase 0 against the result must still print
  `PROFILE = nuxt-marketing`.
