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

`--no-install` skips `pnpm add` (the manifest already declares every dependency);
`--no-commit` skips `git init` and the initial commit; `--force` allows a
non-empty target.

## What it writes

```
nuxt.config.ts          i18n with NO fallbackLocale, cloudflare_module preset, prerender
content.config.ts       one `pages` collection, schema-validated
content/<locale>/       one index.md per locale
i18n/locales/<code>.json
app/pages/[...slug].vue the only place queryCollection() is called
app/components/blocks/  blocks take props and never query
server/api/             exactly contact.post.ts and newsletter.post.ts
wrangler.jsonc          one Worker per site
```

## The four things the layout guarantees

1. `@nuxt/content` **and** `@nuxtjs/i18n` land in `dependencies`, never
   `devDependencies` — conditions 2 and 3 of the detection rung.
2. No auth dependency of any kind — condition 4.
3. `server/api/` holds the two form routes and nothing else. The rung
   deliberately does not test for that directory, precisely so a site keeps
   detecting once it grows a contact form.
4. No `fallbackLocale` anywhere: a missing locale renders nothing rather than
   shipping untranslated copy. The profile's pre-commit gate greps for it.

Verify a scaffold resolves correctly by running `bigin-harness-setup`'s Phase 0
against it — it must print `PROFILE = nuxt-marketing`.
