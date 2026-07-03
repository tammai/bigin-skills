# Bootstrap — non-interactive Nuxt 4 init + module install

> **Executed by `../scripts/scaffold.mjs`** — this doc is the rationale/maintenance reference for that script's command sequence, not instructions to run by hand. If you change a stage here, change the matching function in `scaffold.mjs` (and vice versa).

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
- `--force` — proceed when the dir is non-empty (e.g. one that already has `.git`). **Warning:** `--force` replaces any conflicting files with template files — not just Nuxt artifacts. Non-trivial existing files (hand-authored README, config) may be destroyed. The preflight guard checks for `nuxt.config.ts` only; warn the user if the directory contains other valuable files.
- `--modules pinia,auth-utils,vueuse` — installs and registers all three Nuxt modules atomically during init, eliminating the separate `nuxi module add` calls (and the partial-state risk they carry). Stage 2 only needs the plain packages.

> Base dependencies install as part of init, and `--gitInit` creates a clean repo (the giget template carries no git history — no manual reset needed). If `--gitInit` ever does not fire, run `git init` explicitly.

**Registration check** (the CLI is unpinned now, so `--modules` silently changing behavior on a future release is exactly the risk the old pin was covering — a failed registration here would otherwise only surface confusingly at Stage 5 or later):
```sh
grep -q "@pinia/nuxt" nuxt.config.ts && grep -q "nuxt-auth-utils" nuxt.config.ts && grep -q "@vueuse/nuxt" nuxt.config.ts || { echo "Stage 1's --modules flag did not register pinia/auth-utils/vueuse in nuxt.config.ts — create-nuxt@latest's --modules behavior may have changed; stop and re-verify Stage 1"; exit 1; }
```

Set `package.json` `name` → `{PROJECT_NAME}` (kebab-case — SKILL.md Step 2 validates this against `^[a-z0-9]+(-[a-z0-9]+)*$` before it reaches here; never substitute an unvalidated value into the command below):
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

## Stage 1 (cloned templates) — every `template` other than `starter`

`create-nuxt@latest`'s `--template`/`--modules` flags only work for its own official template set (`ui`, `ui-pro`, etc.) — an arbitrary community/org repo isn't one of those, so this path skips `npm create` entirely and uses `nuxi init`'s giget passthrough instead (the same tool `stage1Init`'s starter path already falls back to, not a new dependency):

```sh
npx nuxi@latest init . --template gh:nuxt-ui-templates/<slug> --packageManager pnpm --gitInit --force
```

`TEMPLATE_REPOS` in `scaffold.mjs` maps `template` → `<slug>` (`saas`, `dashboard`, `landing`, `docs`, `portfolio`, `chat`, `changelog`, `editor` — all under the `nuxt-ui-templates` GitHub org, the same one `ui.nuxt.com/templates` links to). `--modules` is **not** passed here — arbitrary giget templates don't support it, so the BFF preset's core modules are added explicitly right after clone instead of during init:

```sh
pnpm add @pinia/nuxt nuxt-auth-utils @vueuse/nuxt
```

followed by `ensureModuleRegistered()` for each (the same helper Stage 2b already uses for `@nuxt/image`/`@nuxt/content` when `nuxi module add` silently fails to register) — this puts the cloned-template path at parity with what `--modules` gives the `starter` path *before* Stage 1b runs, so Stage 1b's refresh + safety checks work unmodified across every template.

Shape verified during authoring (fetched live from GitHub): only `nuxt-ui-templates/saas`. It has `app/app.config.ts` with `css:`/`routeRules` present in `nuxt.config.ts` (Stage 1b's safety check passes), `ui: { colors: { primary, neutral } }` in `app.config.ts` (the theme regex in `applyArtifacts` matches `primary:\s*(['"])[a-z]+\1` anywhere in the file regardless of nesting, so no special-casing was needed), and already bundles `@nuxt/content` + `@nuxt/image` (which is why `optionalModules` must be empty for non-`starter` templates — see Stage 2b below). The other 7 slugs (`dashboard`, `landing`, `docs`, `portfolio`, `chat`, `changelog`, `editor`) were **not** individually fetched — they rely solely on Stage 1b's generic safety checks (`nuxt` v4, `app/app.config.ts` + `eslint.config.mjs` existing, `css:`/`routeRules` in `nuxt.config.ts`) to fail loudly rather than silently if their shape doesn't match. Re-verify a slug's shape the first time a real scaffold with that `template` value is attempted.

---

## Stage 1b — Refresh template-installed packages / Làm mới gói do template cài

`create-nuxt@latest`'s `--template ui` and `--modules` flags install whatever `@nuxt/ui` / `@nuxt/eslint` / `eslint` / `tailwindcss` / `vue-tsc` / `typescript` / `@pinia/nuxt` / `nuxt-auth-utils` / `@vueuse/nuxt` / `nuxt` versions were current when that `create-nuxt` release was published — not necessarily current *now* (this is how a scaffolded app can end up on a Tailwind release that predates newer palettes like `mauve`/`olive`/`mist`/`taupe`). This stage re-pins all of them to fresh releases, per `VERSION_POLICY` (set in `SKILL.md` Step 2; default `capped`):

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
- `latest` always takes the newest release, including a future major, if the user opted in during SKILL.md Step 2.
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

The `--template ui` init already installed `@nuxt/ui`, `@nuxt/eslint`, `vue-tsc`, and `tailwindcss`. The `--modules pinia,auth-utils,vueuse` flag in Stage 1 already installed and registered `@pinia/nuxt`, `nuxt-auth-utils`, and `@vueuse/nuxt` in `nuxt.config.ts`. Stage 2 adds the rest:

```sh
pnpm add @pinia/colada @pinia/colada-nuxt zod
pnpm add -D vitest @nuxt/test-utils happy-dom simple-git-hooks lint-staged openapi-typescript
pnpm approve-builds simple-git-hooks || true
```

`zod` and the dev tooling are plain packages (not Nuxt modules) — consumed in code, no `nuxt.config.ts` registration needed. `@pinia/colada-nuxt` **is** a Nuxt module and must be registered in `nuxt.config.ts`'s `modules` array — per the [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html), this isn't an optional SSR nicety, it's required for `useQuery`/`useMutation` to work at all; the module also auto-installs the `PiniaColadaSSRNoGc` plugin so SSR caching needs no extra `await`. `nuxi module add` is unreliable non-interactively (see the `image`/`content` caveats below), so the script registers it directly via `ensureModuleRegistered('@pinia/colada-nuxt')` right after `pnpm add` rather than shelling out to `nuxi`. `happy-dom` is required by `@nuxt/test-utils`'s `environment: 'nuxt'` (set in `vitest.config.ts`, Stage 3) — without it `pnpm test` fails outright with "Could not resolve happy-dom". The second `pnpm add` line above will exit 1 with `ERR_PNPM_IGNORED_BUILDS` because of `simple-git-hooks` — that's expected (see "Build-script approval" above); the `approve-builds` line immediately after handles it.

If any `pnpm add` fails, report which package failed and stop — do not continue with a partial install. (`ERR_PNPM_IGNORED_BUILDS` is the one exception — see "Build-script approval" above.)

---

## Stage 2b — Optional extras / Module tuỳ chọn (only if the user opted in)

Skipped entirely when `template !== 'starter'` — every cloned template already bundles whatever `image`/`content`-equivalent it needs (the `saas` template ships both already); `optionalModules` must be `[]` for those templates (`validateConfig` fails fast otherwise).

If `image` was chosen:
```sh
pnpm exec nuxi module add image          # @nuxt/image
pnpm approve-builds sharp || true
```
`nuxi module add image`'s internal install of `sharp` (native image processing) can hit the build-approval gate — when it does, `nuxi` silently defaults "No" to a hidden "continue anyway?" prompt instead of failing loudly, leaving `@nuxt/image` unregistered in `nuxt.config.ts`. Pre-installing `sharp` yourself first does **not** reliably prevent this — `nuxi` can resolve a different `sharp` version internally and hit the gate again regardless. The `approve-builds sharp` call above is still required even though `nuxi` already failed once: `sharp` was installed with its build deferred, and **every subsequent `pnpm` command** (`pnpm exec eslint`, `pnpm lint`, etc.) fails outright with `ERR_PNPM_IGNORED_BUILDS` during pnpm's own deps-status check until it's approved — this is not just a registration problem, it blocks the Stage 5 verify gate entirely if skipped.

**Always** read `nuxt.config.ts` after this command and confirm `'@nuxt/image'` is actually in the `modules` array — this is not a rare edge case, treat it as expected. If it's missing, add it with your normal edit tool (not a shell regex/sed one-liner — a naive text substitution can silently strip the file's trailing newline and trip `@stylistic/eol-last` in `pnpm lint`). Note: the template's `nuxt.config.ts` is already missing its trailing newline before this edit even happens (see `artifacts.md`'s Stage 3 note) — check for `\n` at EOF regardless of whether this edit was needed.

If `content` was chosen, install its SQLite driver **before** adding the module — otherwise `nuxi module add content` hangs forever on a non-interactive stdin prompt asking to install it, with no timeout:
```sh
pnpm add -D better-sqlite3 || true   # expected exit 1 (ERR_PNPM_IGNORED_BUILDS) — better-sqlite3 still installs, script deferred
pnpm approve-builds better-sqlite3 || true
pnpm exec nuxi module add content        # @nuxt/content
```

> `@nuxt/icon`, `@nuxt/fonts`, and `@nuxtjs/color-mode` are already installed as dependencies of `@nuxt/ui` (the `ui` template) — do not re-add them.

---

## Stage 3 — Apply artifacts / Áp dụng các tệp mẫu

Write/merge the files in `references/artifacts.md` (substitute `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`). `nuxt.config.ts`, `package.json`, `.claude/settings.json`, and `.vscode/settings.json` are **merged**, never overwritten.

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

`lint`, `type-check`, and `test` must pass before the scaffold is considered complete. (`session.test.ts` is written in Stage 3, so `pnpm test` validates the Vitest + Nuxt + Pinia Colada chain.) Verify the Nuxt major version (`node -e "console.log(require('nuxt/package.json').version)"` — must start with `4`). Stop and fix any errors before the initial commit.
