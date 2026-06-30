# Scaffold Skill Template — nuxt-scaffold

Used by SKILL.md **Phase 0.5**. When the nuxt profile is chosen and the repo has no `nuxt.config.ts`, Phase 0.5:

1. Writes the **SKILL.md Content** section below verbatim to `.claude/skills/nuxt-scaffold/SKILL.md` in the target project (self-contained, no external skill dependencies).
2. Immediately executes the scaffold steps from that content.
3. Sets `SCAFFOLDED=true` so the governance overlay reconciles with what the template provides.

The generated skill is preserved in the project so teammates can re-run or inspect it without needing `bigin-skills` installed.

---

## SKILL.md Content

Write the block below verbatim to `.claude/skills/nuxt-scaffold/SKILL.md`:

```markdown
---
name: nuxt-scaffold
description: "Scaffolds this repo as a Nuxt 4 fullstack BFF app from tammai/nuxt-fullstack-template. MUST use when user says: 'scaffold nuxt', 'create nuxt app', 'initialize nuxt project', or when the repo has no nuxt.config.ts and a Nuxt BFF app is needed."
---

# nuxt-scaffold

Scaffolds this repo as a Nuxt 4 fullstack BFF app from `tammai/nuxt-fullstack-template` — in-place (preserves the existing `.git`).

Stack: Nuxt 4, Nuxt ESLint, Pinia + Colada, VueUse, Nuxt UI, nuxt-auth-utils, Zod, Vitest + Playwright, simple-git-hooks + lint-staged.
BFF proxy layer — no Drizzle/D1/KV/R2; the backend owns data persistence.

## Step 1: Confirm

Ask the user before proceeding:

```
No nuxt.config.ts found. Scaffold a full Nuxt 4 BFF app from
tammai/nuxt-fullstack-template into this repo? (yes / no)
```

If no → stop.

## Step 2: Gather customization inputs

Before cloning anything, ask the user for the following. Accept Enter to use the default.

**Project name** (kebab-case, used in `package.json` name):
> Default: current directory name

**Theme** — choose primary and neutral colors for `app/app.config.ts`:
> Primary (default `blue`): blue / green / red / purple / orange / teal / cyan / pink / indigo / violet / rose / sky
> Neutral (default `slate`): slate / gray / zinc / neutral / stone

Show a summary of the chosen values and ask the user to confirm before proceeding.

## Step 3: Clone in place, reset git history

```sh
tmp=$(mktemp -d)
git clone --depth 1 git@github.com:tammai/nuxt-fullstack-template.git "$tmp"
rm -rf "$tmp/.git"
cp -R "$tmp/." .
rm -rf "$tmp"
rm -rf .git
git init
```

The template's git history is discarded; the project starts with a clean repo.

## Step 4: Apply customization + strip unwanted files

Using the inputs collected in Step 2:

- Set `package.json` `name` → project name.
- Set theme in `app/app.config.ts` → chosen primary and neutral colors.
- Remove the DB layer (BFF doesn't access the DB directly):
  - Run `pnpm remove drizzle-orm drizzle-kit` (and any other Drizzle deps present in package.json)
  - Delete `server/db/` and `drizzle.config.ts` if present
  - Remove any `db:*` scripts from `package.json`
- Delete `wrangler.toml` — not used by the BFF layer.

## Step 5: Install + activate hooks

```sh
pnpm install
pnpm simple-git-hooks
```

## Notes

- Playwright browsers are not installed automatically — run `pnpm exec playwright install chromium` when needed.
- The template's login endpoint has a hardcoded credential check — replace with a real backend call before shipping.
- Re-run `bigin-harness-setup` after scaffold to overlay the BigIn governance layer if it hasn't been applied yet.
```
