---
name: next-scaffold
description: "Scaffolds a Next.js BFF app — non-interactive, template-driven. Default `starter` template runs `create-next-app` from scratch, then layers the BFF preset (Zustand, TanStack Query, shadcn/ui, Zod, Vitest) on top. `dashboard` adds the official shadcn `dashboard-01` admin-shell block; `saas` adds a real-backend auth flow — hand-authored login/signup pages that call the paired backend, the token pair sealed into an iron-session cookie, and a private `/dashboard` gated on it. MUST use when user says: 'scaffold next', 'create next app', 'initialize next.js project', 'new next bff', 'set up next.js', 'next dashboard template', 'next saas template', 'tạo next', 'khởi tạo next.js', 'cài next', or when the repo has no next.config.ts. Also invoked by bigin-harness-setup Phase 0.5d for the next profile on an empty repo."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# next-scaffold

This skill is mechanical: gather config, write it, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Next.js BFF app from a chosen template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the config values, write them to a JSON file, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Next.js (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query, Zod, Vitest + Testing Library, simple-git-hooks + lint-staged. BFF proxy layer — the backend owns data persistence.

**Templates** (`template` config field, default `starter`):

| slug | source | shape |
| --- | --- | --- |
| `starter` (default) | `create-next-app` (no clone, no block) | minimal Next + shadcn/ui base (Button/Card/Tooltip) + BFF preset, no auth wired |
| `dashboard` | `create-next-app` + shadcn `dashboard-01` block | working admin shell straight at `/dashboard` (sidebar, charts, data table on sample data) |
| `saas` | `create-next-app` + shadcn `input`/`label` primitives + hand-authored pages | public site **+ private `/dashboard`** — real-backend auth: login/signup/logout call the paired backend, the returned token pair is sealed into the iron-session cookie, and `/api/backend/*` proxies all authenticated data calls (see `references/artifacts.md`) |

Unlike `nuxt-scaffold`'s 9 templates (6 of which clone a whole separate GitHub repo from `nuxt-ui-templates`), shadcn/ui has no equivalent gallery of full standalone app templates — only an official **block registry** (`dashboard-01`, `login-03`, etc.) of individual compositions added into an existing app via `shadcn add`. `next-scaffold` therefore ships exactly the two templates that get real bespoke treatment in the Nuxt world (`saas`, `dashboard`) plus the default — not a 1:1 count match. See `references/bootstrap.md` for the full rationale.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js 20+, pnpm. Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-app` first).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`next.config.ts` (or `.js`/`.mjs`) exists + both signature files (`vitest.config.ts`, `.claude/settings.json`) + `node_modules/` all exist** → complete scaffold. Say so and stop.
- **`next.config.*` exists but a signature file or `node_modules/` is missing** → partial scaffold (prior failed run, or a maintainer's `skipInstall: true` run that still needs installing/verifying). Ask: *"Partial scaffold detected — resume (install BFF preset + apply artifacts + verify)? (yes / no)"*. If yes → set `resume: true` in the config and continue to Step 2. If no → stop.
- **No `next.config.*`** → ask: *"Scaffold a Next.js BFF app in this repo (non-interactive create-next-app + BFF preset + config)? (yes / no)"*. If no → stop.

(The script re-checks all of this and fails fast rather than overwriting — but resolving it conversationally first avoids a wasted run.)

## Step 2: Gather config

`AskUserQuestion` accepts up to 4 questions in a **single** call, rendered as one widget. **Exactly one `AskUserQuestion` tool call**, with a `questions` array holding both objects below — not two separate calls. They don't depend on each other, so array order doesn't matter.

1. **Template** — options: `Starter — bare BFF, no auth` (recommended/default), `Dashboard — shadcn admin shell (dashboard-01 block)`, `SaaS — public site + private dashboard, real-backend auth`.
2. **Dependency freshness** — options: `capped — latest minor/patch within the shipped major (safe, default)`, `latest — newest release including a future major`.

**Then, plain conversational free text** (not `AskUserQuestion`, needs regex validation, so it can't be a 3rd array entry): **Project name** — kebab-case, default = current directory name, must match `^[a-z0-9]+(-[a-z0-9]+)*$` — re-prompt if it doesn't.

No theme/base-color question — as of this writing the shadcn CLI's `init` command has no non-interactive base-color flag (only `--template`/`--base`/`--preset`), so `next-scaffold` accepts whatever its `nova` default preset picks. Re-verify `references/bootstrap.md` if the CLI gains one later.

Show a summary as a bullet list (`AskUserQuestion`'s question text doesn't render markdown tables — pipes/dashes show up literally, only `**bold**` renders), e.g. `- **Project name:** my-app`, one bullet per field, and confirm. If no → stop.

## Step 3: Write config & run the script

Write the answers to a JSON file **outside the target repo** (temp/scratchpad dir):

```jsonc
{
  "projectName": "my-app",           // required, kebab-case
  "targetDir": ".",                  // default "."
  "packageManager": "pnpm",          // BigIn standard; the script rejects anything else
  "template": "starter",             // "starter" | "dashboard" | "saas"
  "versionPolicy": "capped",         // "capped" | "latest"
  "resume": false,                   // true only when Step 1 detected a partial scaffold
  "gitCommit": true,                 // final "chore: scaffold Next.js app" commit
  "skipInstall": false               // advanced/maintainer flag — see below; never set true from Step 2's normal flow
}
```

`skipInstall` (default `false`, not part of Step 2's questions) writes every file and merges every `package.json` entry but never runs `create-next-app`'s install, `pnpm add`, `pnpm simple-git-hooks`, `shadcn init`/`add`, or the verify stage — the preset packages land in `package.json` pinned to the `latest` dist-tag, unresolved, and shadcn/ui is not initialized at all. Use it only for fast maintainer iteration on `scaffold.mjs`/templates (see "Manual validation" below); the result is not a runnable app until `pnpm install` + `npx shadcn@latest init` are run manually. Never set this from the normal user-facing flow.

Then run it from the target directory, streaming output (it can take several minutes — installs + lint + type-check + tests):

```sh
node <this-skill-dir>/scripts/scaffold.mjs --config <path-to-config.json>
```

Zero prompts occur once the script starts. Every step it performs (init, version refresh, BFF preset, shadcn/ui, artifacts, hooks, verify, commit) is internal — do not duplicate any of it.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → config problem; fix the JSON per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing stage/command. Common causes: Node < 20, pnpm missing, network failure during `create-next-app`, or a `create-next-app@latest`/`shadcn@latest` behavior change (the error will say to re-verify `references/bootstrap.md`). A failed run partway through leaves a partial scaffold — after fixing the cause, re-run with `"resume": true`.

---

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir on **both macOS and Windows**:

```sh
mkdir scaffold-test && cd scaffold-test
echo '{"projectName":"scaffold-test","packageManager":"pnpm"}' > ../cfg.json
node <skill-dir>/scripts/scaffold.mjs --config ../cfg.json
```

Expect: exit 0, all three verify gates green, initial commit created. Then re-run the same command → must fail fast with "scaffold looks complete", exit 1, no files touched.

For a fast file-tree-only pass while iterating on templates (add `"skipInstall": true` to the config), expect exit 0 in a few seconds — no install, no shadcn init, no verify, no hooks activated — then inspect the written files directly; don't treat that run as a stand-in for the full validation above.

At minimum also re-verify `template: "saas"` and `template: "dashboard"` the same way whenever `templates/saas/` or the `TEMPLATE_BLOCKS` map changes — `saas` is the one template with bespoke files, `dashboard` is the one that depends on the shadcn block registry still shipping `dashboard-01`.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), CRLF checkouts vs ESLint's stylistic rules, and utf8 decoding of subprocess output.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/` — **source of truth** for every file written/merged into the project.
- `references/bootstrap.md` — rationale for the command sequence the script executes.
- `references/artifacts.md` — rationale + merge semantics for each template.
- `references/modules.md` — BFF preset, shadcn block registry notes.
