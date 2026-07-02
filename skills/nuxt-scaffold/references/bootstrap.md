# Bootstrap — non-interactive Nuxt 4 init + module install

The canonical command sequence. Scaffolds **in-place** into the current directory (`.`), installs the BFF preset, then leaves the project ready for artifact application.

Verified against `create-nuxt` v3.36.1 (https://nuxt.com/docs/4.x/api/commands/init). Non-interactive behavior confirmed empirically against this version — re-validate on version bumps.

> Requires: Node 22+, pnpm. Run from the repo root (for a brand-new project: `mkdir my-app && cd my-app` first).

**Pre-flight checks** — run before Stage 1:

```sh
node -e "process.exit(Number(process.version.slice(1).split('.')[0]) >= 22 ? 0 : 1)" || { echo "Node.js 22+ required (found $(node -v))"; exit 1; }
pnpm --version >/dev/null 2>&1 || { echo "pnpm is required but not installed. Install: corepack enable && corepack prepare pnpm@latest --activate"; exit 1; }
```

**Monorepo warning:** if a parent `pnpm-workspace.yaml` exists above the target directory, `pnpm add` may hoist dependencies to the root. Scaffold outside the workspace, or use `--ignore-workspace` on each `pnpm add` call.

---

## Stage 1 — Non-interactive init / Khởi tạo không tương tác

```sh
npm create nuxt@3.36.1 . -- --template ui --packageManager pnpm --gitInit --force --modules pinia,auth-utils,vueuse
```

Flag rationale (verified against `create-nuxt` v3.36.1):
- `npm create nuxt@3.36.1 .` — pinned version (non-interactive behavior confirmed empirically against this version; re-validate on version bumps). `.` = scaffold into the current dir (in-place).
- `--` — pass the remaining flags through `npm create` to `create-nuxt`.
- `--template ui` — **required** in a non-interactive terminal (create-nuxt aborts with "Missing required argument: --template" without it). `ui` = the official Nuxt UI starter, which already installs and registers `@nuxt/ui` + `@nuxt/eslint`, sets the eslint stylistic config, and ships `app.vue` / `app.config.ts` / `pages/index.vue` / `eslint.config.mjs`.
- `--packageManager pnpm` — non-interactive package-manager choice (no prompt).
- `--gitInit` — initialize the git repo as part of init. It **only fires when the install step runs**, so do **not** pair it with `--no-install` (create-nuxt silently skips gitInit under `--no-install`). Do not omit `--gitInit`.
- `--force` — proceed when the dir is non-empty (e.g. one that already has `.git`). **Warning:** `--force` replaces any conflicting files with template files — not just Nuxt artifacts. Non-trivial existing files (hand-authored README, config) may be destroyed. The Phase 1 guard checks for `nuxt.config.ts` only; warn the user if the directory contains other valuable files.
- `--modules pinia,auth-utils,vueuse` — installs and registers all three Nuxt modules atomically during init, eliminating the separate `nuxi module add` calls (and the partial-state risk they carry). Stage 2 only needs the plain packages.

> Base dependencies install as part of init, and `--gitInit` creates a clean repo (the giget template carries no git history — no manual reset needed). If `--gitInit` ever does not fire, run `git init` explicitly.

Set `package.json` `name` → `{PROJECT_NAME}` (kebab-case — SKILL.md Phase 2 validates this against `^[a-z0-9]+(-[a-z0-9]+)*$` before it reaches here; never substitute an unvalidated value into the command below):
```sh
PROJECT_NAME='{PROJECT_NAME}' node -e "const p=require('./package.json');p.name=process.env.PROJECT_NAME;require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
```

If `npm create` does not forward a flag in your environment, the direct primitive is `npx nuxi@3.36.1 init . --template ui --packageManager pnpm --gitInit --force --modules pinia,auth-utils,vueuse`.

If `npm create` exits non-zero:
1. Check Node ≥ 22 (`node -v`).
2. If ENOENT or network error, retry once after `npm cache clean --force`.
3. Fall back to `npx nuxi@latest init . --template ui --packageManager pnpm --gitInit --force`.
4. If still failing, report the error and stop.

---

## Stage 2 — Install the BFF preset / Cài đặt bộ module BFF

The `--template ui` init already installed `@nuxt/ui`, `@nuxt/eslint`, `vue-tsc`, and `tailwindcss`. The `--modules pinia,auth-utils,vueuse` flag in Stage 1 already installed and registered `@pinia/nuxt`, `nuxt-auth-utils`, and `@vueuse/nuxt` in `nuxt.config.ts`. Stage 2 only adds the plain packages (no Nuxt module registration needed):

```sh
pnpm add @pinia/colada zod
pnpm add -D vitest @nuxt/test-utils simple-git-hooks lint-staged openapi-typescript
```

`@pinia/colada`, `zod`, and the dev tooling are plain packages (not Nuxt modules), so they are added with `pnpm add` — they are consumed in code, not registered in `nuxt.config.ts`.

If any `pnpm add` fails, report which package failed and stop — do not continue with a partial install.

---

## Stage 2b — Optional extras / Module tuỳ chọn (only if the user opted in)

```sh
pnpm exec nuxi module add image          # @nuxt/image
pnpm exec nuxi module add content        # @nuxt/content
```

> `@nuxt/icon`, `@nuxt/fonts`, and `@nuxtjs/color-mode` are already installed as dependencies of `@nuxt/ui` (the `ui` template) — do not re-add them.

---

## Stage 2c — Optional Drizzle + Cloudflare D1 / Drizzle + Cloudflare D1 (tuỳ chọn, chỉ khi `WANT_DRIZZLE = yes`)

```sh
pnpm add drizzle-orm
pnpm add -D drizzle-kit @cloudflare/workers-types wrangler
```

`wrangler` is required to apply migrations (`wrangler d1 execute`) and to resolve the D1 database from `wrangler.toml` — `drizzle-kit migrate` alone only works against a local SQLite file. See `references/artifacts.md` → `## Drizzle opt-in` for the `wrangler.toml`, `server/db/schema.ts`, `drizzle.config.ts`, and `db:*` scripts to write. Default is **BFF proxy, no DB** — only add this when the user explicitly opts in.

---

## Stage 3 — Apply artifacts / Áp dụng các tệp mẫu

Write/merge the files in `references/artifacts.md` (substitute `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`, `{D1_DATABASE_ID}`, `{COMPAT_DATE}`). `nuxt.config.ts`, `package.json`, `.claude/settings.json`, and `.vscode/settings.json` are **merged**, never overwritten.

---

## Stage 4 — Activate the project commit gate

```sh
pnpm simple-git-hooks
```

Wires the `pre-commit` → `pnpm exec lint-staged` hook declared in `package.json`. (This is the project-level git gate, distinct from the Claude-level `bash-guard` PreToolUse hook that `bigin-harness-setup` adds later.)

---

## Stage 5 — Verify / Kiểm tra

```sh
pnpm lint
pnpm type-check
pnpm test
```

`lint`, `type-check`, and `test` must pass before the scaffold is considered complete. (`session.test.ts` is written in Phase 5, so `pnpm test` validates the Vitest + Nuxt + Pinia Colada chain.) Verify the Nuxt major version (`node -e "console.log(require('nuxt/package.json').version)"` — must start with `4`) and confirm `nuxt.config.ts` has `compatibilityVersion: 4`. Stop and fix any errors before the initial commit.
