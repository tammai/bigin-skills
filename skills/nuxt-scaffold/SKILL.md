---
name: nuxt-scaffold
description: "Scaffolds a Nuxt 4 BFF app — non-interactive, template-driven. Default `starter` template runs `npm create nuxt@latest` from scratch (no GitHub clone); every other template (saas, dashboard, landing, docs, portfolio, chat, changelog, editor) clones the matching official ui.nuxt.com/templates starter, then layers the BFF preset modules + config + sample code on top. MUST use when user says: 'scaffold nuxt', 'create nuxt app', 'initialize nuxt project', 'new nuxt bff', 'set up nuxt', 'nuxt saas template', 'nuxt dashboard template', 'tạo nuxt', 'khởi tạo nuxt', 'cài nuxt', or when the repo has no nuxt.config.ts. Also invoked by bigin-harness-setup Phase 0.5 for the nuxt profile on an empty repo."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# nuxt-scaffold

This skill is mechanical: gather config, write it, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Nuxt 4 BFF app from a chosen template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the config values, write them to a JSON file, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Nuxt 4, Nuxt UI v4, Nuxt ESLint, Pinia + Pinia Colada, VueUse, nuxt-auth-utils, Zod, Vitest, simple-git-hooks + lint-staged. BFF proxy layer — the backend owns data persistence.

**Templates** (`template` config field, default `starter`):

| slug | source | shape |
| --- | --- | --- |
| `starter` (default) | `npm create nuxt@latest --template ui` (no clone) | minimal Nuxt UI + BFF preset, no auth wired |
| `saas` | clones `github.com/nuxt-ui-templates/saas` | public landing/pricing/blog/docs **+ private `/dashboard`** gated by `nuxt-auth-utils` auth wired to the paired backend (login/signup/logout call the real API; token pair stored in the session's server-only `secure` key) |
| `dashboard` | clones `github.com/nuxt-ui-templates/dashboard` | admin-style multi-column shell |
| `landing` | clones `github.com/nuxt-ui-templates/landing` | marketing landing page |
| `docs` | clones `github.com/nuxt-ui-templates/docs` | documentation site |
| `portfolio` | clones `github.com/nuxt-ui-templates/portfolio` | portfolio/blog |
| `chat` | clones `github.com/nuxt-ui-templates/chat` | AI chatbot (Vercel AI SDK) |
| `changelog` | clones `github.com/nuxt-ui-templates/changelog` | GitHub-releases-powered changelog site |
| `editor` | clones `github.com/nuxt-ui-templates/editor` | Notion-like WYSIWYG editor |

Only `saas` gets the extra private-dashboard/auth treatment. Every other cloned template gets the BFF preset layered on top and nothing more.

### BFF backend wiring (all templates)

Every template ships the full BFF proxy against the paired **Go backend** (ADR default pairing): a same-origin catch-all proxy at `server/api/backend/[...path].ts` (attaches the session's Bearer token, runs 401→refresh→retry-once), a CSRF middleware (`server/middleware/csrf.ts`) rejecting cross-site mutations, and a generated typed client (`shared/api-client/`, from the committed `openapi.yaml` snapshot via `pnpm openapi-types`) wrapped in Pinia Colada composables. The token pair lives only in nuxt-auth-utils' server-only `secure` session key — never sent to the browser. `saas` adds the auth routes (`login`/`signup`/`logout`) that populate that session.

### Known deliberate asymmetry: Nuxt Layers, `starter` only

The **`starter`** template is the only one restructured into Nuxt **Layers** (`layers/<feature>/app/{pages,composables,components}` + `layers/shared/{app,api-client}`), with `imports: { scan: false }` on feature layers (the ADR §5.1/5.3 precondition for boundary lint to see real imports) and `eslint-plugin-boundaries` blocking cross-layer imports. The **other 8 cloned templates get the BFF wiring above but NOT the Layers restructuring** — retrofitting Layers onto an externally-cloned ui.nuxt.com template's existing upstream structure risks fighting its layout, so it's intentionally skipped. This is a known, accepted gap, not an oversight.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js 22+, pnpm. Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-app` first).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`nuxt.config.ts` exists + both signature files (`vitest.config.ts`, `.claude/settings.json`) + `node_modules/` all exist** → complete scaffold. Say so and stop.
- **`nuxt.config.ts` exists but a signature file or `node_modules/` is missing** → partial scaffold (prior failed run, or a maintainer's `skipInstall: true` run that still needs installing/verifying). Ask: *"Partial scaffold detected — resume (install BFF preset + apply artifacts + verify)? (yes / no)"*. If yes → set `resume: true` in the config and continue to Step 2 (theme answers are still needed for the artifact stage). If no → stop.
- **No `nuxt.config.ts`** → ask: *"Scaffold a Nuxt 4 BFF app in this repo (non-interactive npm create nuxt@latest + BFF preset + config)? (yes / no)"*. If no → stop.

(The script re-checks all of this and fails fast rather than overwriting — but resolving it conversationally first avoids a wasted run.)

## Step 2: Gather config

`AskUserQuestion` accepts up to 4 questions in a **single** call, rendered as one widget. Prior fixes (v1.21.1, v1.21.6) tried enforcing "one call" via prose alone — a numbered 1-4 list read as "call the tool once per numbered item," and it kept regressing to 2 (or 4) separate tool invocations in the same turn, each rendering its own question list. There is no `questions.length` autosplit — the model must place all 4 objects in one `questions` array itself.

**Exactly one `AskUserQuestion` tool call, with a `questions` array holding all 4 objects below.** Not one call per item, not two calls of two — one invocation, `questions: [ {...}, {...}, {...}, {...} ]`. They don't depend on each other, so array order doesn't matter. If you find yourself about to emit a second `AskUserQuestion` tool call in this same turn, stop — fold the remaining question(s) into the first call's array instead.

1. **Template** — options: `Starter — bare BFF, no auth` (recommended/default), `SaaS — public site + private dashboard, demo auth`, `Dashboard — admin-style multi-column shell`, and a 4th option labeled `Other templates` whose **description spells out every remaining slug by name** — `landing` (marketing page), `docs` (documentation site), `portfolio` (portfolio/blog), `chat` (AI chatbot), `changelog` (GitHub-releases site), `editor` (WYSIWYG editor) — so the user knows exactly what to type before picking the tool's own "Other" free-text option. (Never add your own option literally labeled "Other" — `AskUserQuestion` adds that automatically; `Other templates` is the label that carries the descriptive list.) If the typed value isn't one of the 9 slugs, list them again and re-ask.
2. **Theme — primary color** — options: `blue` (default), `green`, `orange`, and a 4th option labeled `Other colors` whose description lists all 14 remaining Nuxt UI primary colors by name — `emerald`, `teal`, `cyan`, `sky`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `amber`, `yellow`, `lime`, `red` — so the user knows exactly what to type into the tool's own "Other" free-text option. Re-prompt if the typed value isn't one of the 17.
3. **Theme — neutral color** — options: `slate` (default), `zinc`, `stone`, and a 4th option labeled `Other colors` whose description lists the 6 remaining Nuxt UI neutral colors by name — `gray`, `neutral`, `taupe`, `mauve`, `mist`, `olive`. Re-prompt if invalid.
4. **Dependency freshness** — options: `capped — latest minor/patch within the shipped major (safe, default)`, `latest — newest release including a future major`.

**Then, plain conversational free text** (not `AskUserQuestion`, needs regex validation, so it can't be a 5th array entry): **Project name** — kebab-case, default = current directory name, must match `^[a-z0-9]+(-[a-z0-9]+)*$` — re-prompt if it doesn't.

No optional-module question — the scaffolder never installs `@nuxt/image`/`@nuxt/content`; `fonts` / `icon` / `color-mode` come with Nuxt UI regardless.

Show a summary as a bullet list (`AskUserQuestion`'s question text doesn't render markdown tables — pipes/dashes show up literally, only `**bold**` renders), e.g. `- **Project name:** my-app`, one bullet per field, and confirm. If no → stop.

## Step 3: Write config & run the script

Write the answers to a JSON file **outside the target repo** (temp/scratchpad dir):

```jsonc
{
  "projectName": "my-app",           // required, kebab-case
  "targetDir": ".",                  // default "."
  "packageManager": "pnpm",          // BigIn standard; the script rejects anything else
  "template": "starter",             // "starter" | "saas" | "dashboard" | "landing" | "docs" | "portfolio" | "chat" | "changelog" | "editor"
  "theme": { "primary": "blue", "neutral": "slate" },
  "versionPolicy": "capped",         // "capped" | "latest"
  "resume": false,                   // true only when Step 1 detected a partial scaffold
  "gitCommit": true,                 // final "chore: scaffold Nuxt 4 BFF app" commit
  "skipInstall": false               // advanced/maintainer flag — see below; never set true from Step 2's normal flow
}
```

`skipInstall` (default `false`, not part of Step 2's questions) writes every file and merges every `package.json` entry but never runs `npm create`'s install, `pnpm add`, `pnpm simple-git-hooks`, or the verify stage — the preset packages land in `package.json` pinned to the `latest` dist-tag, unresolved. Use it only for fast maintainer iteration on `scaffold.mjs`/templates (see "Manual validation" below); the result is not a runnable app until `pnpm install` is run manually. Never set this from the normal user-facing flow.

Then run it from the target directory, streaming output (it can take several minutes — installs + lint + type-check + tests):

```sh
node <this-skill-dir>/scripts/scaffold.mjs --config <path-to-config.json>
```

Zero prompts occur once the script starts. Every step it performs (init, version refresh, BFF preset, artifacts, hooks, verify, commit) is internal — do not duplicate any of it.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → config problem; fix the JSON per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing stage/command. Common causes: Node < 22, pnpm missing, network failure during `npm create`, or a `create-nuxt@latest` behavior change (the error will say to re-verify `references/bootstrap.md`). A failed run partway through leaves a partial scaffold — after fixing the cause, re-run with `"resume": true`.

---

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir on **both macOS and Windows**:

```sh
mkdir scaffold-test && cd scaffold-test
echo '{"projectName":"scaffold-test","packageManager":"pnpm","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json
node <skill-dir>/scripts/scaffold.mjs --config ../cfg.json
```

Expect: exit 0, all three verify gates green, initial commit created. Then re-run the same command → must fail fast with "scaffold looks complete", exit 1, no files touched.

For a fast file-tree-only pass while iterating on templates (add `"skipInstall": true` to the config), expect exit 0 in a few seconds — no install, no verify, no hooks activated — then inspect the written files directly; don't treat that run as a stand-in for the full validation above.

At minimum also re-verify `template: "saas"` the same way (`echo '{"projectName":"scaffold-saas-test","packageManager":"pnpm","template":"saas","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json`) whenever `templates/saas/` or the clone path in `stage1Init()` changes — it's the one template with bespoke files and a different Stage 1 command. The other 7 cloned slugs share the same generic clone-and-layer path; spot-check one (e.g. `dashboard` or `landing`) opportunistically rather than on every change.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), `^` in semver specs under cmd.exe, CRLF checkouts vs `@stylistic` lint rules, and utf8 decoding of subprocess output.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/` — **source of truth** for every file written/merged into the project.
- `references/bootstrap.md` — rationale for the command sequence the script executes.
- `references/artifacts.md` — rationale + merge semantics for each template.
- `references/modules.md` — BFF preset, optional-modules menu.
