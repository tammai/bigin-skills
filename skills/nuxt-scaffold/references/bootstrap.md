# Bootstrap — non-interactive Nuxt 4 init + module install

The canonical command sequence. Scaffolds **in-place** into the current directory (`.`), installs the BFF preset, then leaves the project ready for artifact application.

Uses `npm create nuxt@latest` (unpinned) — non-interactive flag behavior (`--template` required, `--modules` atomic install, `--gitInit` quirks) was last verified against `create-nuxt` v3.36.1 (https://nuxt.com/docs/4.x/api/commands/init); a future `create-nuxt` release could change that behavior without notice, so re-verify Stage 1 if it starts failing. Stage 1b separately refreshes the packages the CLI installs to current releases per `VERSION_POLICY`, so scaffolded apps don't inherit a stale `@nuxt/ui`/`tailwindcss`/etc. snapshot regardless of which CLI version ran.

> Requires: Node 22+, pnpm. Run from the repo root (for a brand-new project: `mkdir my-app && cd my-app` first).

**Pre-flight checks** — run before Stage 1:

```sh
node -e "process.exit(Number(process.version.slice(1).split('.')[0]) >= 22 ? 0 : 1)" || { echo "Node.js 22+ required (found $(node -v))"; exit 1; }
pnpm --version >/dev/null 2>&1 || { echo "pnpm is required but not installed. Install: corepack enable && corepack prepare pnpm@latest --activate"; exit 1; }
```

**Monorepo warning:** if a parent `pnpm-workspace.yaml` exists above the target directory, `pnpm add` may hoist dependencies to the root. Scaffold outside the workspace, or use `--ignore-workspace` on each `pnpm add` call.

**Build-script approval:** pnpm 10+ blocks a dependency's postinstall/build scripts by default. `simple-git-hooks`, `better-sqlite3` (via `@nuxt/content`), `sharp` (via `@nuxt/image`), and `esbuild`/`workerd` (via `wrangler`) all hit this. `sharp` is the odd one out for *when* it's approved — pre-installing it before `nuxi module add image` doesn't reliably help, since `nuxi` can resolve a different version internally anyway, so approval has to happen *after* that call (see Stage 2b) alongside a mandatory post-hoc registration check. It still needs `pnpm approve-builds sharp` like the others — skipping it breaks every later `pnpm` command, not just the module registration. For all four packages, two things matter here:

1. **The `pnpm add` that introduces the package exits 1 with `ERR_PNPM_IGNORED_BUILDS` — but the package still installs**, just with its build script deferred pending approval. This is *not* the "partial install, stop" failure the stages below otherwise warn about — treat this specific error as expected, run `pnpm approve-builds <pkg>` (named in the error output) immediately after, and continue.
2. **Naming a package that isn't actually pending approval fails the whole `pnpm approve-builds` call** (`ERR_PNPM_APPROVE_BUILDS_UNKNOWN_PACKAGES`) — which packages end up pending is environment-dependent (already-approved/already-built packages don't need it again). Where a stage below approves more than one package, run each as its own `pnpm approve-builds <pkg> || true` so one non-pending name doesn't block the others.

---

## Stage 1 — Non-interactive init / Khởi tạo không tương tác

```sh
npm create nuxt@latest . -- --template ui --packageManager pnpm --gitInit --force --modules pinia,auth-utils,vueuse
```

Flag rationale (behavior last verified against `create-nuxt` v3.36.1 — re-validate against whatever `@latest` resolves to if Stage 1 starts failing):
- `npm create nuxt@latest .` — unpinned; always takes the current `create-nuxt` release. `.` = scaffold into the current dir (in-place).
- `--` — pass the remaining flags through `npm create` to `create-nuxt`.
- `--template ui` — **required** in a non-interactive terminal (create-nuxt aborts with "Missing required argument: --template" without it). `ui` = the official Nuxt UI starter, which already installs and registers `@nuxt/ui` + `@nuxt/eslint`, sets the eslint stylistic config, and ships `app.vue` / `app.config.ts` / `pages/index.vue` / `eslint.config.mjs`.
- `--packageManager pnpm` — non-interactive package-manager choice (no prompt).
- `--gitInit` — initialize the git repo as part of init. It **only fires when the install step runs**, so do **not** pair it with `--no-install` (create-nuxt silently skips gitInit under `--no-install`). Do not omit `--gitInit`.
- `--force` — proceed when the dir is non-empty (e.g. one that already has `.git`). **Warning:** `--force` replaces any conflicting files with template files — not just Nuxt artifacts. Non-trivial existing files (hand-authored README, config) may be destroyed. The Phase 1 guard checks for `nuxt.config.ts` only; warn the user if the directory contains other valuable files.
- `--modules pinia,auth-utils,vueuse` — installs and registers all three Nuxt modules atomically during init, eliminating the separate `nuxi module add` calls (and the partial-state risk they carry). Stage 2 only needs the plain packages.

> Base dependencies install as part of init, and `--gitInit` creates a clean repo (the giget template carries no git history — no manual reset needed). If `--gitInit` ever does not fire, run `git init` explicitly.

**Registration check** (the CLI is unpinned now, so `--modules` silently changing behavior on a future release is exactly the risk the old pin was covering — a failed registration here would otherwise only surface confusingly at Stage 5 or later):
```sh
grep -q "@pinia/nuxt" nuxt.config.ts && grep -q "nuxt-auth-utils" nuxt.config.ts && grep -q "@vueuse/nuxt" nuxt.config.ts || { echo "Stage 1's --modules flag did not register pinia/auth-utils/vueuse in nuxt.config.ts — create-nuxt@latest's --modules behavior may have changed; stop and re-verify Stage 1"; exit 1; }
```

Set `package.json` `name` → `{PROJECT_NAME}` (kebab-case — SKILL.md Phase 2 validates this against `^[a-z0-9]+(-[a-z0-9]+)*$` before it reaches here; never substitute an unvalidated value into the command below):
```sh
PROJECT_NAME='{PROJECT_NAME}' node -e "const p=require('./package.json');p.name=process.env.PROJECT_NAME;require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
```

If `npm create` does not forward a flag in your environment, the direct primitive is `npx nuxi@latest init . --template ui --packageManager pnpm --gitInit --force --modules pinia,auth-utils,vueuse`.

If `npm create` exits non-zero:
1. Check Node ≥ 22 (`node -v`).
2. If ENOENT or network error, retry once after `npm cache clean --force`.
3. Fall back to `npx nuxi@latest init . --template ui --packageManager pnpm --gitInit --force`.
4. If still failing, report the error and stop.

---

## Stage 1b — Refresh template-installed packages / Làm mới gói do template cài

`create-nuxt@latest`'s `--template ui` and `--modules` flags install whatever `@nuxt/ui` / `@nuxt/eslint` / `eslint` / `tailwindcss` / `vue-tsc` / `typescript` / `@pinia/nuxt` / `nuxt-auth-utils` / `@vueuse/nuxt` / `nuxt` versions were current when that `create-nuxt` release was published — not necessarily current *now* (this is how a scaffolded app can end up on a Tailwind release that predates newer palettes like `mauve`/`olive`/`mist`/`taupe`). This stage re-pins all of them to fresh releases, per `VERSION_POLICY` (set in `SKILL.md` Phase 2; default `capped`):

Do this in a single `node -e` script, not a shell loop — a shell `for` loop over an unquoted variable relies on word-splitting that **zsh does not do by default** (unlike bash/sh), which silently collapses the whole package list into one bogus argument and corrupts `pnpm add`. Reading each package's version via plain `require('<pkg>/package.json')` also breaks for any package with a restrictive `exports` map (`@nuxt/ui`, `@nuxt/eslint`, `@pinia/nuxt`, `nuxt-auth-utils` all throw `ERR_PACKAGE_PATH_NOT_EXPORTED`) — read the file directly instead. Calling `pnpm` via `execFileSync` with an argument array sidesteps shell parsing entirely, so neither problem can recur:

```sh
node -e "
const fs = require('fs');
const { execFileSync } = require('child_process');
const policy = process.env.VERSION_POLICY || 'capped';
const pkgs = 'nuxt @nuxt/ui @nuxt/eslint eslint tailwindcss vue-tsc typescript @pinia/nuxt nuxt-auth-utils @vueuse/nuxt'.split(' ');
const specs = pkgs.map(function (p) {
  if (policy === 'latest') return p + '@latest';
  var pkgPath = 'node_modules/' + p + '/package.json';
  if (!fs.existsSync(pkgPath)) { console.error('Stage 1b: ' + p + ' was not installed by Stage 1 — create-nuxt@latest template package set may have changed; stop and re-verify Stage 1'); process.exit(1); }
  var v = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  return p + '@^' + v.split('.')[0];
});
execFileSync('pnpm', ['add'].concat(specs), { stdio: 'inherit' });
"
```

- `capped` (default) resolves the latest release within each package's *currently installed* major — fixes staleness without risking a silent major bump.
- `latest` always takes the newest release, including a future major, if the user opted in during Phase 2.
- pnpm preserves each package's existing `dependencies`/`devDependencies` placement on a bare `pnpm add <pkg>@<version>` — this step only refreshes versions, not sections.
- Pre-1.0 packages (`@pinia/nuxt`, `nuxt-auth-utils` at the time of writing) only get patch-level bumps under `capped` — npm's caret range is stricter for `0.x` versions. This is a known, minor gap in "latest minor/patch" framing for that case, not a bug.

**Safety check** (catches an unwanted major, and a changed template shape, before Stage 2/3 do more work on top of it):
```sh
NUXT_MAJOR=$(node -e "console.log(require('nuxt/package.json').version.split('.')[0])")
[ "$NUXT_MAJOR" = "4" ] || { echo "nuxt is now v$NUXT_MAJOR (expected v4) — stop, re-validate this skill before continuing"; exit 1; }
test -f app/app.config.ts && test -f eslint.config.mjs && grep -q "css:" nuxt.config.ts && grep -q "routeRules" nuxt.config.ts || { echo "create-nuxt@latest's template shape changed — re-verify Stage 3's merge instructions (nuxt.config.ts key order, app.config.ts) before continuing"; exit 1; }
```

If any `pnpm add` fails, report which package and stop — do not continue with a partial install. (`ERR_PNPM_IGNORED_BUILDS` is the one exception — see "Build-script approval" above.)

---

## Stage 2 — Install the BFF preset / Cài đặt bộ module BFF

The `--template ui` init already installed `@nuxt/ui`, `@nuxt/eslint`, `vue-tsc`, and `tailwindcss`. The `--modules pinia,auth-utils,vueuse` flag in Stage 1 already installed and registered `@pinia/nuxt`, `nuxt-auth-utils`, and `@vueuse/nuxt` in `nuxt.config.ts`. Stage 2 only adds the plain packages (no Nuxt module registration needed):

```sh
pnpm add @pinia/colada zod
pnpm add -D vitest @nuxt/test-utils happy-dom simple-git-hooks lint-staged openapi-typescript
pnpm approve-builds simple-git-hooks || true
```

`@pinia/colada`, `zod`, and the dev tooling are plain packages (not Nuxt modules), so they are added with `pnpm add` — they are consumed in code, not registered in `nuxt.config.ts`. `happy-dom` is required by `@nuxt/test-utils`'s `environment: 'nuxt'` (set in `vitest.config.ts`, Stage 3) — without it `pnpm test` fails outright with "Could not resolve happy-dom". The second `pnpm add` line above will exit 1 with `ERR_PNPM_IGNORED_BUILDS` because of `simple-git-hooks` — that's expected (see "Build-script approval" above); the `approve-builds` line immediately after handles it.

If any `pnpm add` fails, report which package failed and stop — do not continue with a partial install. (`ERR_PNPM_IGNORED_BUILDS` is the one exception — see "Build-script approval" above.)

---

## Stage 2b — Optional extras / Module tuỳ chọn (only if the user opted in)

If `image` was chosen:
```sh
pnpm exec nuxi module add image          # @nuxt/image
pnpm approve-builds sharp || true
```
`nuxi module add image`'s internal install of `sharp` (native image processing) can hit the build-approval gate — when it does, `nuxi` silently defaults "No" to a hidden "continue anyway?" prompt instead of failing loudly, leaving `@nuxt/image` unregistered in `nuxt.config.ts`. Pre-installing `sharp` yourself first does **not** reliably prevent this — `nuxi` can resolve a different `sharp` version internally and hit the gate again regardless. The `approve-builds sharp` call above is still required even though `nuxi` already failed once: `sharp` was installed with its build deferred, and **every subsequent `pnpm` command** (`pnpm exec eslint`, `pnpm lint`, etc.) fails outright with `ERR_PNPM_IGNORED_BUILDS` during pnpm's own deps-status check until it's approved — this is not just a registration problem, it blocks Phase 6's verify gate entirely if skipped.

**Always** read `nuxt.config.ts` after this command and confirm `'@nuxt/image'` is actually in the `modules` array — this is not a rare edge case, treat it as expected. If it's missing, add it with your normal edit tool (not a shell regex/sed one-liner — a naive text substitution can silently strip the file's trailing newline and trip `@stylistic/eol-last` in `pnpm lint`). Note: the template's `nuxt.config.ts` is already missing its trailing newline before this edit even happens (see `artifacts.md`'s Stage 3 note) — check for `\n` at EOF regardless of whether this edit was needed.

If `content` was chosen, install its SQLite driver **before** adding the module — otherwise `nuxi module add content` hangs forever on a non-interactive stdin prompt asking to install it, with no timeout:
```sh
pnpm add -D better-sqlite3 || true   # expected exit 1 (ERR_PNPM_IGNORED_BUILDS) — better-sqlite3 still installs, script deferred
pnpm approve-builds better-sqlite3 || true
pnpm exec nuxi module add content        # @nuxt/content
```

> `@nuxt/icon`, `@nuxt/fonts`, and `@nuxtjs/color-mode` are already installed as dependencies of `@nuxt/ui` (the `ui` template) — do not re-add them.

---

## Stage 2c — Optional Drizzle + Cloudflare D1 / Drizzle + Cloudflare D1 (tuỳ chọn, chỉ khi `WANT_DRIZZLE = yes`)

```sh
pnpm add drizzle-orm
pnpm add -D drizzle-kit @cloudflare/workers-types wrangler || true   # wrangler pulls in esbuild/workerd (native); expect ERR_PNPM_IGNORED_BUILDS
pnpm approve-builds esbuild || true
pnpm approve-builds workerd || true
```
Only one of `esbuild`/`workerd` may actually be pending approval (depends on what's already built) — approving each separately with `|| true` means a non-pending name doesn't block the other.

`wrangler` is required to apply migrations (`wrangler d1 execute`) and to resolve the D1 database from `wrangler.toml` — `drizzle-kit migrate` alone only works against a local SQLite file. See `references/artifacts.md` → `## Drizzle opt-in` for the `wrangler.toml`, `server/db/schema.ts`, `drizzle.config.ts`, and `db:*` scripts to write. Default is **BFF proxy, no DB** — only add this when the user explicitly opts in.

---

## Stage 3 — Apply artifacts / Áp dụng các tệp mẫu

Write/merge the files in `references/artifacts.md` (substitute `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`, `{D1_DATABASE_ID}`, `{COMPAT_DATE}`). `nuxt.config.ts`, `package.json`, `.claude/settings.json`, and `.vscode/settings.json` are **merged**, never overwritten.

---

## Stage 4 — Activate the project commit gate

```sh
pnpm simple-git-hooks
```

Wires the `pre-commit` → `pnpm exec lint-staged` hook declared in `package.json`. (This is the project-level git gate, distinct from the Claude-level `bash-guard` PreToolUse hook that `bigin-harness-setup` adds later.) Stage 2 already ran `pnpm approve-builds simple-git-hooks` right after installing it — if this command still fails with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds simple-git-hooks` again here before retrying.

---

## Stage 5 — Verify / Kiểm tra

```sh
pnpm lint
pnpm type-check
pnpm test
```

`lint`, `type-check`, and `test` must pass before the scaffold is considered complete. (`session.test.ts` is written in Phase 5, so `pnpm test` validates the Vitest + Nuxt + Pinia Colada chain.) Verify the Nuxt major version (`node -e "console.log(require('nuxt/package.json').version)"` — must start with `4`). Stop and fix any errors before the initial commit.
