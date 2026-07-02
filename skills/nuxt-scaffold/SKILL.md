---
name: nuxt-scaffold
description: "Scaffolds a Nuxt 4 BFF app from scratch — non-interactive `npm create nuxt@latest`, then the BFF preset modules, then config + sample code. No GitHub clone. MUST use when user says: 'scaffold nuxt', 'create nuxt app', 'initialize nuxt project', 'new nuxt bff', 'set up nuxt', 'tạo nuxt', 'khởi tạo nuxt', 'cài nuxt', or when the repo has no nuxt.config.ts. Also invoked by bigin-harness-setup Phase 0.5 for the nuxt profile on an empty repo."
---

# nuxt-scaffold

Scaffolds a Nuxt 4 BFF app **from scratch** — no GitHub template clone. Three stages: non-interactive `npm create nuxt@latest` → install the BFF preset (+ optional extras) → apply config and sample code.

*Khởi tạo ứng dụng Nuxt 4 BFF từ đầu — không clone template. Ba giai đoạn: tạo dự án bằng `npm create nuxt@latest` → cài bộ module BFF → áp dụng config và code mẫu.*

Stack: Nuxt 4, Nuxt UI v4, Nuxt ESLint, Pinia + Pinia Colada, VueUse, nuxt-auth-utils, Zod, Vitest, simple-git-hooks + lint-staged. BFF proxy layer — the backend owns data persistence.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.py`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

---

## Prerequisites / Điều kiện tiên quyết

- Node.js 22+, pnpm.
- Run from the directory where the app should live. For a brand-new project: `mkdir my-app && cd my-app` first. Scaffolding is **in-place** into the current directory.
- **Idempotent:** if `nuxt.config.ts` exists, check for signature files (`vitest.config.ts` + `.claude/settings.json`). If both exist → complete scaffold, stop. If either is missing → partial scaffold, offer resume from Phase 4.

---

## Phase 1: Confirm / Xác nhận

If `nuxt.config.ts` exists:
- Check for **signature files** — `vitest.config.ts` and `.claude/settings.json`. If either is missing, it's a **partial scaffold** (likely from a prior failed run). Offer:
  ```
  nuxt.config.ts found but vitest.config.ts or .claude/settings.json is missing
  — partial scaffold detected.
  Resume from Phase 4 (install BFF modules + apply artifacts + verify)?
  (yes / no)
  ```
  If yes → skip to Phase 4. If no → stop.
- If **both** signature files exist → stop; the project is already fully scaffolded.

If no `nuxt.config.ts` at all:
```
No nuxt.config.ts found. Scaffold a Nuxt 4 BFF app in this repo
(non-interactive npm create nuxt@latest + BFF preset + config)?
(yes / no)
```
Store `CONFIRM`. If `no` → stop.

---

## Phase 2: Gather Customization / Thu thập tuỳ chỉnh

Ask everything up front (Enter = default), then confirm. Store each in a SHOUTING-CAPS var.

```
Customize the scaffold (press Enter to keep the default):

1. Project name (kebab-case, used in package.json)
   > Default: <current directory name>
   > Must match ^[a-z0-9]+(-[a-z0-9]+)*$ — re-prompt if it doesn't (this value is
   > substituted into shell/JS one-liners in Phase 3; reject anything else, e.g.
   > quotes, backticks, spaces, path separators).

2. Theme — primary color (Nuxt UI)
   > Default: blue
   > Options: blue / green / emerald / teal / cyan / sky / indigo / violet /
              purple / fuchsia / pink / rose / amber / yellow / lime / orange / red

3. Theme — neutral color (Nuxt UI)
   > Default: slate
   > Options: slate / gray / zinc / neutral / stone

4. Optional modules (comma-separated, or Enter for none)
   > Options: image / content   (fonts / icon / color-mode already come with Nuxt UI)

5. Database layer — add Drizzle + Cloudflare D1? (BFF default = no DB)
   > Default: no   (yes / no)

[If WANT_DRIZZLE = yes:]
6. Cloudflare D1 database ID (from `wrangler d1 list` — the UUID `wrangler d1 create` returns)
   > Default: leave as placeholder (replace before first deploy)
```

If `WANT_DRIZZLE = yes`, store `D1_DATABASE_ID` (or the literal `{D1_DATABASE_ID}` if the user accepted the default). Otherwise store the empty string.

Show a summary table and confirm:
```
Summary:
  project:  <PROJECT_NAME>
  theme:    primary=<PRIMARY>, neutral=<NEUTRAL>
  modules:  <OPT_MODULES or none>
  database: <WANT_DRIZZLE — no | Drizzle + D1>
  d1-id:    <D1_DATABASE_ID or "(placeholder — replace before deploy)">

Proceed? (yes / no)
```
Store `CONFIRM_CUSTOM`. If `no` → stop.

`PACKAGE_MANAGER` is always `pnpm`.

---

## Phase 3: Non-interactive Init / Khởi tạo không tương tác

Follow `references/bootstrap.md` → **Stage 1** (`npm create nuxt@3.36.1 . -- --template ui --packageManager pnpm --gitInit --force --modules pinia,auth-utils,vueuse`). The `--modules` flag installs and registers `@pinia/nuxt`, `nuxt-auth-utils`, and `@vueuse/nuxt` atomically during init. This installs the base dependencies (the `ui` template already brings `@nuxt/ui`, `@nuxt/eslint`, `vue-tsc`) and creates the git repo (`--gitInit` fires only when install runs — do not pair it with `--no-install`). If `npm create` does not forward flags, use the `npx nuxi@3.36.1 init` fallback in `references/bootstrap.md`.

Run the pre-flight checks in bootstrap.md (Node 22+ and pnpm) before executing Stage 1.

Then set `package.json` `name` → `PROJECT_NAME`.

---

## Phase 4: Install BFF Preset / Cài đặt bộ module BFF

Follow `references/bootstrap.md` → **Stage 2** (`pnpm add @pinia/colada zod` + `pnpm add -D vitest @nuxt/test-utils simple-git-hooks lint-staged openapi-typescript`). The Nuxt modules (`pinia`, `auth-utils`, `vueuse`) were already installed and registered by the `--modules` flag in Stage 1 — Stage 2 only adds the plain packages. See `references/modules.md` for the full preset and rationale.

- If `OPT_MODULES` is non-empty → run **Stage 2b** for each chosen module.
- If `WANT_DRIZZLE = yes` → run **Stage 2c**.
- If any `pnpm add` fails, report which package and stop — do not continue with a partial install.

---

## Phase 5: Apply Artifacts / Áp dụng các tệp mẫu

Follow `references/bootstrap.md` → **Stage 3** (the artifact-application stage). Read `references/artifacts.md` and write/merge each block, substituting `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`, `{D1_DATABASE_ID}`, and `{COMPAT_DATE}` (generated from today's date: `node -e "console.log(new Date().toISOString().split('T')[0])"`).

- **Merge** (never overwrite): `nuxt.config.ts` (add `compatibilityVersion` + `runtimeConfig` only), `app/app.config.ts` (set theme colors), `package.json`, `tsconfig.json` (add `shared/` to `include`), `.claude/settings.json`, `.vscode/settings.json`.
- **Write fresh**: `server/api/me.get.ts`, `server/api/login.post.ts`, `server/api/users.get.ts`, `shared/types/auth.d.ts`, `app/stores/session.ts`, `app/stores/session.test.ts`, `vitest.config.ts`, `.prettierignore`, `app/composables/useUsers.ts`, `app/middleware/auth.global.ts`, `server/middleware/auth.ts`, `openapi.yaml`, `.env.example` (and the Drizzle files if opted in).
- **Do not touch** the template's own `app/app.vue`, `app/pages/index.vue`, `eslint.config.mjs`, or `app/assets/css/main.css`.
- After writing `.env.example`, verify `.env` is listed in `.gitignore` — append it if missing (before Phase 7's commit).

Write the Drizzle opt-in blocks only when `WANT_DRIZZLE = yes`.

---

## Phase 6: Activate Hooks & Verify / Kích hoạt hook & Kiểm tra

Follow `references/bootstrap.md` → **Stage 4** (`pnpm simple-git-hooks`) and **Stage 5**:
```sh
pnpm lint
pnpm type-check
pnpm test
```
`lint`, `type-check`, and `test` must pass before continuing. (The `ui` template pins `@nuxt/ui` ^4, so no v3/v4 fallback is needed. `session.test.ts` was written in Phase 5 — `pnpm test` validates the Vitest + Nuxt + Pinia Colada chain.)

---

## Phase 7: Initial Commit / Commit đầu tiên

Only if `.git` exists and the working tree is dirty (`git status --porcelain` is non-empty — the `--gitInit` flag already creates an initial commit for the template, but Phases 4–6 add uncommitted BFF changes):
```sh
git add -A
git commit -m "chore: scaffold Nuxt 4 BFF app"
```

---

## Phase 8: Next Steps / Bước tiếp theo

Print:
```
Nuxt 4 BFF app scaffolded.

Next:
  1. Copy .env.example → .env and set:
     - NUXT_SESSION_PASSWORD (openssl rand -base64 32)
     - NUXT_BACKEND_URL     (backend REST API; server-only)
  2. Replace the stub openapi.yaml with the real backend contract, then:
     pnpm openapi-types
  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).
  4. Start: pnpm dev
```

---

## Idempotency / Tính bền vững

- If `nuxt.config.ts` exists AND both signature files (`vitest.config.ts` + `.claude/settings.json`) exist → complete scaffold, stop at Phase 1.
- If `nuxt.config.ts` exists BUT either signature file is missing → partial scaffold; offer resume from Phase 4.
- `nuxt.config.ts` / `app/app.config.ts` / `package.json` / `.claude/settings.json` / `.vscode/settings.json` — always merge, never overwrite.
- Never delete files not created by this skill.

---

## References / Tài liệu tham khảo

- `references/bootstrap.md` — the canonical command sequence (init + install + verify).
- `references/modules.md` — BFF preset, optional-modules menu, Drizzle opt-in.
- `references/artifacts.md` — every file written/merged into the project.
