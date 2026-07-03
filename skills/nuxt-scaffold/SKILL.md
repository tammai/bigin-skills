---
name: nuxt-scaffold
description: "Scaffolds a Nuxt 4 BFF app — non-interactive, template-driven. Default `starter` template runs `npm create nuxt@latest` from scratch (no GitHub clone); every other template (saas, dashboard, landing, docs, portfolio, chat, changelog, editor) clones the matching official ui.nuxt.com/templates starter, then layers the BFF preset modules + config + sample code on top. MUST use when user says: 'scaffold nuxt', 'create nuxt app', 'initialize nuxt project', 'new nuxt bff', 'set up nuxt', 'nuxt saas template', 'nuxt dashboard template', 'tạo nuxt', 'khởi tạo nuxt', 'cài nuxt', or when the repo has no nuxt.config.ts. Also invoked by bigin-harness-setup Phase 0.5 for the nuxt profile on an empty repo."
---

# nuxt-scaffold

Scaffolds a Nuxt 4 BFF app from a chosen template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the config values, write them to a JSON file, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Nuxt 4, Nuxt UI v4, Nuxt ESLint, Pinia + Pinia Colada, VueUse, nuxt-auth-utils, Zod, Vitest, simple-git-hooks + lint-staged. BFF proxy layer — the backend owns data persistence.

**Templates** (`template` config field, default `starter`):

| slug | source | shape |
| --- | --- | --- |
| `starter` (default) | `npm create nuxt@latest --template ui` (no clone) | minimal Nuxt UI + BFF preset, no auth wired |
| `saas` | clones `github.com/nuxt-ui-templates/saas` | public landing/pricing/blog/docs **+ private `/dashboard`** gated by demo `nuxt-auth-utils` auth (no real backend — see `references/artifacts.md`) |
| `dashboard` | clones `github.com/nuxt-ui-templates/dashboard` | admin-style multi-column shell |
| `landing` | clones `github.com/nuxt-ui-templates/landing` | marketing landing page |
| `docs` | clones `github.com/nuxt-ui-templates/docs` | documentation site |
| `portfolio` | clones `github.com/nuxt-ui-templates/portfolio` | portfolio/blog |
| `chat` | clones `github.com/nuxt-ui-templates/chat` | AI chatbot (Vercel AI SDK) |
| `changelog` | clones `github.com/nuxt-ui-templates/changelog` | GitHub-releases-powered changelog site |
| `editor` | clones `github.com/nuxt-ui-templates/editor` | Notion-like WYSIWYG editor |

Only `saas` gets the extra private-dashboard/auth treatment. Every other cloned template gets the BFF preset layered on top and nothing more.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js 22+, pnpm. Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-app` first).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`nuxt.config.ts` exists + both signature files (`vitest.config.ts`, `.claude/settings.json`) exist** → complete scaffold. Say so and stop.
- **`nuxt.config.ts` exists but a signature file is missing** → partial scaffold (prior failed run). Ask: *"Partial scaffold detected — resume (install BFF preset + apply artifacts + verify)? (yes / no)"*. If yes → set `resume: true` in the config and continue to Step 2 (theme/module answers are still needed for the artifact stage). If no → stop.
- **No `nuxt.config.ts`** → ask: *"Scaffold a Nuxt 4 BFF app in this repo (non-interactive npm create nuxt@latest + BFF preset + config)? (yes / no)"*. If no → stop.

(The script re-checks all of this and fails fast rather than overwriting — but resolving it conversationally first avoids a wasted run.)

## Step 2: Gather config

`AskUserQuestion` accepts up to 4 questions in a **single** call, rendered as one widget. Use that instead of separate sequential calls — a v1.21.1 fix tried enforcing "one `AskUserQuestion` call per turn" via wording alone, and it still regressed to firing two calls (and two question lists) in the same turn. Bundling into one call removes the failure mode structurally instead of relying on turn discipline.

**Call 1 — one `AskUserQuestion` call with all 4 questions below** (they don't depend on each other, so order within the call doesn't matter):

1. **Template** — options: `Starter — bare BFF, no auth` (recommended/default), `SaaS — public site + private dashboard, demo auth`, `Dashboard — admin-style multi-column shell`, and a 4th option labeled `Other templates` whose **description spells out every remaining slug by name** — `landing` (marketing page), `docs` (documentation site), `portfolio` (portfolio/blog), `chat` (AI chatbot), `changelog` (GitHub-releases site), `editor` (WYSIWYG editor) — so the user knows exactly what to type before picking the tool's own "Other" free-text option. (Never add your own option literally labeled "Other" — `AskUserQuestion` adds that automatically; `Other templates` is the label that carries the descriptive list.) If the typed value isn't one of the 9 slugs, list them again and re-ask.
2. **Theme — primary color** — options: `blue` (default), `green`, `orange`, and a 4th option labeled `Other colors` whose description lists all 14 remaining Nuxt UI primary colors by name — `emerald`, `teal`, `cyan`, `sky`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `amber`, `yellow`, `lime`, `red` — so the user knows exactly what to type into the tool's own "Other" free-text option. Re-prompt if the typed value isn't one of the 17.
3. **Theme — neutral color** — options: `slate` (default), `zinc`, `stone`, and a 4th option labeled `Other colors` whose description lists the 6 remaining Nuxt UI neutral colors by name — `gray`, `neutral`, `taupe`, `mauve`, `mist`, `olive`. Re-prompt if invalid.
4. **Dependency freshness** — options: `capped — latest minor/patch within the shipped major (safe, default)`, `latest — newest release including a future major`.

**Then, plain conversational free text** (not `AskUserQuestion`, needs regex validation, so it can't be a 5th question in Call 1): **Project name** — kebab-case, default = current directory name, must match `^[a-z0-9]+(-[a-z0-9]+)*$` — re-prompt if it doesn't.

**Call 2 — only if Call 1's Template answer is `starter`**, a second `AskUserQuestion` call: **Optional modules** — multiSelect, options: `image`, `content`, `None` (default). Skip this call entirely for every other template (every other template already bundles what it needs; `fonts` / `icon` / `color-mode` always come with Nuxt UI regardless). This is the one genuinely sequential step — it depends on Call 1's Template answer being known first.

Show a summary table and confirm. If no → stop.

## Step 3: Write config & run the script

Write the answers to a JSON file **outside the target repo** (temp/scratchpad dir):

```jsonc
{
  "projectName": "my-app",           // required, kebab-case
  "targetDir": ".",                  // default "."
  "packageManager": "pnpm",          // BigIn standard; the script rejects anything else
  "template": "starter",             // "starter" | "saas" | "dashboard" | "landing" | "docs" | "portfolio" | "chat" | "changelog" | "editor"
  "theme": { "primary": "blue", "neutral": "slate" },
  "optionalModules": [],             // subset of ["image", "content"] — must be [] unless template is "starter"
  "versionPolicy": "capped",         // "capped" | "latest"
  "resume": false,                   // true only when Step 1 detected a partial scaffold
  "gitCommit": true                  // final "chore: scaffold Nuxt 4 BFF app" commit
}
```

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

At minimum also re-verify `template: "saas"` the same way (`echo '{"projectName":"scaffold-saas-test","packageManager":"pnpm","template":"saas","theme":{"primary":"orange","neutral":"slate"}}' > ../cfg.json`) whenever `templates/saas/` or the clone path in `stage1Init()` changes — it's the one template with bespoke files and a different Stage 1 command. The other 7 cloned slugs share the same generic clone-and-layer path; spot-check one (e.g. `dashboard` or `landing`) opportunistically rather than on every change.

Platform-risky code paths (all flagged in the header comment of `scaffold.mjs`): Windows `.cmd` shim resolution + the `shell: true`-on-win32 EINVAL workaround (`resolveBin`/`run`/`winQuote`), `^` in semver specs under cmd.exe, CRLF checkouts vs `@stylistic` lint rules, and utf8 decoding of subprocess output.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/` — **source of truth** for every file written/merged into the project.
- `references/bootstrap.md` — rationale for the command sequence the script executes.
- `references/artifacts.md` — rationale + merge semantics for each template.
- `references/modules.md` — BFF preset, optional-modules menu.
