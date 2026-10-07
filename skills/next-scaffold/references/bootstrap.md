# Bootstrap — non-interactive Next.js init + preset install

> **Executed by `../scripts/scaffold.mjs`** — this doc is the rationale/maintenance reference for that script's command sequence, not instructions to run by hand. If you change a stage here, change the matching function in `scaffold.mjs` (and vice versa).

The canonical command sequence. Scaffolds **in-place** into the current directory (`.`), installs the preset (pass-through + OpenNext/Cloudflare) + shadcn/ui, then leaves the project ready for artifact application.

Uses **`create-next-app@16.3.8`** (pinned) — non-interactive flag behavior was verified against the Next.js CLI reference (https://nextjs.org/docs/app/api-reference/cli/create-next-app) and confirmed with an actual scaffold run on 2026-10-07. The pin is not a freshness choice: `@opennextjs/cloudflare@1.20.9` builds against `next` 16.3.8, while `create-next-app`'s 16.4.0 installs a `next` that builds but returns 500 on every non-rewrite request (`Unexpected loadManifest(.../preview-props.json)`), despite the adapter's peer range (`>=16.3.8`) — the unit 0 spike in `docs/design/drop-bff.md`. 16.4.0 also installs `@tailwindcss/turbopack`, which stage 1b's `@tailwindcss/postcss` re-pin choked on; 16.3.8 installs `@tailwindcss/postcss`, so `TEMPLATE_PKGS` is unchanged. Bump `next`, `create-next-app` and `@opennextjs/cloudflare` together, and only after a `pnpm preview` against a stub API (see `MAINTAINING.md`). Stage 1b refreshes the *other* packages the CLI installs per `VERSION_POLICY`.

> Requires: Node 20+, pnpm. Run from the repo root (for a brand-new project: `mkdir my-app && cd my-app` first).

**Pre-flight checks** — run before Stage 1:

```sh
node -e "process.exit(Number(process.version.slice(1).split('.')[0]) >= 20 ? 0 : 1)" || { echo "Node.js 20+ required (found $(node -v))"; exit 1; }
pnpm --version >/dev/null 2>&1 || { echo "pnpm is required but not installed. Install: corepack enable && corepack prepare pnpm@latest --activate"; exit 1; }
```

**Monorepo warning:** if a parent `pnpm-workspace.yaml` exists above the target directory, `pnpm add` may hoist dependencies to the root. Scaffold outside the workspace, or use `--ignore-workspace` on each `pnpm add` call.

**Complete vs. partial:** a scaffold is "complete" — and `resume: true` refuses with "nothing to do" — only when `vitest.config.ts`, `.claude/settings.json`, **and** `node_modules/` all exist. The first two are written unconditionally in Stage 3 regardless of `skipInstall`, so they alone can't tell a fully-installed-and-verified scaffold apart from a `skipInstall: true` run that only wrote files. `node_modules/` is the signal a `skipInstall` run never produces.

**Build-script approval:** pnpm 10+ blocks a dependency's postinstall/build scripts by default. `simple-git-hooks` hits this. Two things matter here:

1. **The `pnpm add` that introduces the package exits 1 with `ERR_PNPM_IGNORED_BUILDS` — but the package still installs**, just with its build script deferred pending approval. Treat this specific error as expected, run `pnpm approve-builds <pkg>` immediately after, and continue.
2. **Naming a package that isn't actually pending approval fails the whole `pnpm approve-builds` call.** Run each as its own `pnpm approve-builds <pkg> || true`.

---

## Stage 1 — Non-interactive init

```sh
npx create-next-app@16.3.8 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack --no-agents-md
```

Flag rationale (verified against the Next.js CLI reference):
- `create-next-app@16.3.8 .` — pinned (see above). `.` = scaffold into the current dir (in-place).
- `--ts --tailwind --eslint --app --src-dir --import-alias "@/*"` — explicit (not `--yes`/defaults) so the result doesn't depend on a machine's stored CLI preferences: TypeScript, Tailwind CSS v4 (CSS-first, no `tailwind.config.ts`), ESLint (the sole formatter — no Prettier, matching the nuxt profile's convention), App Router, `src/` layout, `@/*` import alias.
- `--use-pnpm` — non-interactive package-manager choice (no prompt).
- `--turbopack` — explicit even though it's the current default, for the same "don't rely on defaults" reasoning as the flags above.
- `--no-agents-md` — **required**. `--agents-md` (AGENTS.md + **CLAUDE.md**) is on by default; this skill does not own `CLAUDE.md` — `bigin-harness-setup` writes it fresh afterward (same division of labor as `nuxt-scaffold`, which also never writes `CLAUDE.md`). Without this flag, create-next-app's own `CLAUDE.md` would conflict with the harness's.
- No `--disable-git`: create-next-app runs its own `git init` when the install step runs (same "only fires alongside install" behavior as Nuxt's `--gitInit`) — if `--skip-install` suppresses it, the script falls back to running `git init` explicitly.
- `--skip-install` — passed only when `CFG.skipInstall` is true (maintainer fast-iteration path); writes files + `package.json` but skips the dependency install, `shadcn init`, and the verify stage.

> If `create-next-app` does not fire git init (e.g. under `--skip-install`), run `git init` explicitly — the script already does this.

Set `package.json` `name` → `{PROJECT_NAME}` (kebab-case — SKILL.md Step 2 validates this against `^[a-z0-9]+(-[a-z0-9]+)*$` before it reaches here; never substitute an unvalidated value into the command below):
```sh
PROJECT_NAME='{PROJECT_NAME}' node -e "const p=require('./package.json');p.name=process.env.PROJECT_NAME;require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
```

If `create-next-app` exits non-zero:
1. Check Node ≥ 20 (`node -v`).
2. If a network error, retry (the script does not currently auto-retry this one — unlike Nuxt's `npm cache clean --force` retry — because no failure of this kind has been observed yet; add a retry here if one is).
3. If still failing, report the error and stop.

---

## Stage 1 (block-based templates) — `dashboard` and `saas`

Unlike Nuxt UI, shadcn/ui has no gallery of whole standalone app repos to clone — every template starts from the exact same `create-next-app` base as `starter`. What differs is which shadcn **blocks** get added on top in Stage 2 (`dashboard-01` for `dashboard`; `input`/`label` primitives, hand-authored pages, for `saas`) and which `scripts/templates/<slug>/` overlay Stage 3 applies (`saas` only — `dashboard` gets nothing bespoke, matching 6 of Nuxt's 8 non-starter templates getting zero extra files).

Block names verified live against `ui.shadcn.com/blocks` on 2026-07-14: `dashboard-01` ("a dashboard with sidebar, charts and data table"), `login-03` ("a login page with a muted background color"). `login-03` is **not** actually added by the script — its exact generated file paths weren't verified live, so depending on them risked an unpredictable collision with this skill's own hand-authored `src/app/login/page.tsx`. `saas` instead adds only the `input`/`label` primitives (guaranteed to land at `src/components/ui/input.tsx` / `label.tsx` — the CLI's long-stable convention) and this skill's own overlay provides the actual login/signup/dashboard routes. Re-verify block names against `ui.shadcn.com/blocks` before changing `TEMPLATE_BLOCKS` in `scaffold.mjs`.

---

## Stage 1b — Refresh template-installed packages

`create-next-app@16.3.8` installs the `react` / `tailwindcss` / `eslint` / `typescript` versions that were current when that release was published — not necessarily current *now*. This stage re-pins them to fresh releases, per `VERSION_POLICY` (set in `SKILL.md` Step 2; default `capped`), using the same argument-array approach as `nuxt-scaffold` (avoids shell word-splitting and `exports`-map read failures — see that skill's `bootstrap.md` for the full rationale, identical here). **`next` and `eslint-config-next` are exempt from the policy:** they are pinned exactly to 16.3.8 (`NEXT_VERSION` in `scaffold.mjs`) under both `capped` and `latest`, because that is the only `next` OpenNext 1.20.9 is verified against.

```sh
node -e "
const fs = require('fs');
const { execFileSync } = require('child_process');
const policy = process.env.VERSION_POLICY || 'capped';
const pkgs = 'react react-dom typescript eslint tailwindcss @tailwindcss/postcss'.split(' ');
const specs = ['next@16.3.8', 'eslint-config-next@16.3.8'].concat(pkgs.map(function (p) {
  if (policy === 'latest') return p + '@latest';
  var pkgPath = 'node_modules/' + p + '/package.json';
  if (!fs.existsSync(pkgPath)) { console.error('Stage 1b: ' + p + ' was not installed by Stage 1 — create-next-app default package set may have changed; stop and re-verify Stage 1'); process.exit(1); }
  var v = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  return p + '@^' + v.split('.')[0];
}));
execFileSync('pnpm', ['add'].concat(specs), { stdio: 'inherit' });
"
```

shadcn/ui components are copied source files, not a versioned npm dependency of the app — there is nothing to re-pin the way `@nuxt/ui` is re-pinned in the Nuxt profile.

**Safety check** (catches a drifted `next`, and a changed template shape, before Stage 2/3 do more work on top of it):
```sh
NEXT_VERSION=$(node -e "console.log(require('next/package.json').version)")
[ "$NEXT_VERSION" = "16.3.8" ] || { echo "next is v$NEXT_VERSION (expected the pinned 16.3.8) — stop"; exit 1; }
test -f src/app/layout.tsx && (test -f next.config.ts || test -f next.config.js || test -f next.config.mjs) || { echo "create-next-app's template shape changed — re-verify artifacts.md merge instructions before continuing"; exit 1; }
grep -q "tailwindcss" src/app/globals.css || { echo "src/app/globals.css does not import tailwindcss — Tailwind v4 CSS-first shape changed; re-verify artifacts.md"; exit 1; }
```

If any `pnpm add` fails, report which package and stop — do not continue with a partial install. (`ERR_PNPM_IGNORED_BUILDS` is the one exception — see "Build-script approval" above.)

---

## Stage 2 — Install the preset + shadcn/ui

```sh
pnpm add zustand @tanstack/react-query zod openapi-fetch @opennextjs/cloudflare@1.20.9
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom simple-git-hooks lint-staged openapi-typescript eslint-plugin-boundaries eslint-import-resolver-typescript wrangler@^4
for pkg in simple-git-hooks esbuild workerd; do pnpm approve-builds $pkg || true; done

npx shadcn@latest init -y -d
npx shadcn@latest add button card tooltip -y
# + template-specific blocks, see TEMPLATE_BLOCKS in scaffold.mjs
```

The preset is universal (every template ships the OpenNext/Cloudflare config + `/api` rewrite + generated API client + feature-folder boundaries, not just an unauthenticated sample): `openapi-fetch` (runtime typed API client, `src/shared/api-client`), `openapi-typescript` (regenerates the committed client-types snapshot via `pnpm openapi:generate`), and `eslint-plugin-boundaries` + `eslint-import-resolver-typescript` (enforce the feature-folder boundaries in `eslint.config.mjs` — the resolver is load-bearing, see `files/eslint.boundaries.mjs`). `@opennextjs/cloudflare` is exact-pinned (see Stage 1) and `wrangler` stays on its `^4` peer range. `esbuild` and `workerd` — pulled in by wrangler — carry install scripts that pnpm 10+ defers, so their `pnpm add` exits `ERR_PNPM_IGNORED_BUILDS` like `simple-git-hooks` does and is approved the same way. There is no `starter`-only devDependency set.

`zustand` (state), `@tanstack/react-query` (server-state cache — same role as Pinia Colada, and TanStack Query is what Pinia Colada is itself modeled on) and `zod` (validation) are plain packages, consumed in code — no config-file registration step exists in Next the way Nuxt modules need `nuxt.config.ts` registration. There is no session package: the API owns the web session as an HttpOnly cookie, and the app only forwards it.

`shadcn@latest init -y -d` (`--yes --defaults`, i.e. `--template=next --preset=nova`) is fully non-interactive. **There is no `--base-color` flag** (verified live against `ui.shadcn.com/docs/cli` on 2026-07-14 — the `init` flag list has `--template`/`--base`/`--preset`/`--css-variables`/etc. but no color flag), so `next-scaffold` does not ask a base-color question and accepts whatever the `nova` preset's default is. If a future CLI version adds a non-interactive color flag, this is the place to wire a `baseColor` config field the way `nuxt-scaffold` has `theme.primary`/`theme.neutral` — do not fabricate CSS custom-property values by hand instead; shadcn's palette values (`neutral`/`stone`/`zinc`/`mauve`/`olive`/`mist`/`taupe` per `components.json`'s `tailwind.baseColor` docs) were not independently re-derived/verified here.

`shadcn@latest init` is guarded by a `components.json`-existence check before it runs — on `resume: true` (Stage 2 always re-runs on resume) it would otherwise re-write `components.json`/`globals.css` even though init already succeeded once. `pnpm add` and `shadcn add` need no equivalent guard: `pnpm add` on an already-satisfied range is a no-op, and `shadcn add` skips files that already exist rather than overwriting them without `--overwrite`.

If any `pnpm add`/`npx shadcn` command fails, report which one and stop — do not continue with a partial install. (`ERR_PNPM_IGNORED_BUILDS` is the one exception — see "Build-script approval" above.)

---

## Stage 3 — Apply artifacts

Write/merge the files in `references/artifacts.md` (substitute `{PROJECT_NAME}`). `src/app/layout.tsx`, `package.json`, `.claude/settings.json`, and `.vscode/settings.json` are **merged/patched**, never overwritten wholesale. All templates: `eslint.config.mjs` gets the `eslint-plugin-boundaries` wiring (`dashboard` additionally gets a scoped `react-hooks` override for the `dashboard-01` block) — see `artifacts.md`'s per-file notes for why and exactly what each patch does.

---

## Stage 4 — Activate the project commit gate

```sh
pnpm simple-git-hooks
```

Wires the `pre-commit` → `pnpm exec lint-staged` hook declared in `package.json`. (This is the project-level git gate, distinct from the Claude-level `bash-guard` PreToolUse hook that `bigin-harness-setup` adds later.) Stage 2 already ran `pnpm approve-builds simple-git-hooks` right after installing it — if this command still fails with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds simple-git-hooks` again here before retrying.

---

## Stage 5 — Verify

```sh
pnpm lint
pnpm type-check
pnpm test
```

`lint`, `type-check`, and `test` must pass before the scaffold is considered complete. Stage 3 writes the test files (`use-profile.test.tsx` for the Vitest + React Testing Library + TanStack Query chain, `src/shared/api-client/index.test.ts` for the client's base URL and credentials, `src/next-config.test.ts` for the pass-through allowlist; `saas` adds login, signup, dashboard and `AuthGate` tests too), so `pnpm test` validates them. Verify `next` is exactly 16.3.8 (`node -e "console.log(require('next/package.json').version)"`). None of the three runs `next build`, so a broken OpenNext setup would pass them — `MAINTAINING.md` carries the preview check that covers it. Stop and fix any errors before the initial commit.
