---
name: nuxt-scaffold
description: "Scaffolds a new Nuxt 4 app from scratch (no nuxt.config.ts yet) — tokenless /api pass-through to the Go API's cookie session + typed API client; nine templates, starter to saas. Triggers: 'scaffold nuxt', 'create nuxt app', 'nuxt saas template'."
argument-hint: [template]
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# nuxt-scaffold

This skill is mechanical: gather config, write it, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Nuxt 4 app (SPA, `ssr: false`, Cloudflare preset) from a chosen template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the config values, write them to a JSON file, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Nuxt 4, Nuxt UI v4, Nuxt ESLint, Pinia + Pinia Colada, VueUse, Zod, Vitest, simple-git-hooks + lint-staged. No BFF: the browser reaches the Go API through a tokenless same-origin `/api` pass-through, and the API owns the session (an HttpOnly cookie) and the data.

**Templates** (`template` config field, default `starter`):

| slug | source | shape |
| --- | --- | --- |
| `starter` (default) | `npm create nuxt@latest --template ui` (no clone) | minimal Nuxt UI + the pass-through preset, no auth pages |
| `saas` | clones `github.com/nuxt-ui-templates/saas` | public landing/pricing/blog/docs **+ private `/dashboard`** gated by the API's cookie session (login/signup/sign-out call the real API's `/api/v1/auth/*` endpoints through the pass-through; `/dashboard` redirects to `/login` on a 401) |
| `dashboard` | clones `github.com/nuxt-ui-templates/dashboard` | admin-style multi-column shell |
| `landing` | clones `github.com/nuxt-ui-templates/landing` | marketing landing page |
| `docs` | clones `github.com/nuxt-ui-templates/docs` | documentation site |
| `portfolio` | clones `github.com/nuxt-ui-templates/portfolio` | portfolio/blog |
| `chat` | clones `github.com/nuxt-ui-templates/chat` | AI chatbot (Vercel AI SDK) |
| `changelog` | clones `github.com/nuxt-ui-templates/changelog` | GitHub-releases-powered changelog site |
| `editor` | clones `github.com/nuxt-ui-templates/editor` | Notion-like WYSIWYG editor |

Only `saas` gets the extra private-dashboard/auth treatment. Every other cloned template gets the pass-through preset layered on top and nothing more. `saas`, `docs` and `portfolio` also lose `nuxt-og-image` and their `defineOgImage` calls — the module needs SSR, which this scaffold never enables.

### API pass-through (all templates)

Every template ships the same wiring against the paired **Go backend** (ADR default pairing), and no BFF: a catch-all `server/routes/api/[...path].ts` (logic in `server/utils/pass-through.ts`) forwards only `/api/v<digits>/**` to the server-only `NUXT_API_ORIGIN` — streamed, redirects not followed, `Set-Cookie` and `Cookie` untouched, no token held — and answers any other `/api/*` path with a JSON 404. The API sets the HttpOnly `__Host-session` cookie, which is first-party to the app because it arrives through the app's own domain; CSRF is the API's (SameSite=Lax + its `WEB_ORIGINS` check). The scaffold sets `ssr: false` and the `cloudflare_module` Nitro preset, and a generated typed client (`shared/api-client/`, `$fetch.create({ baseURL: '/api', credentials: 'include' })`, from the committed `openapi.yaml` placeholder via `pnpm openapi-types`) is wrapped in Pinia Colada composables. Behind the pass-through the API sees the app's egress address, not the visitor's, so all browser users share one rate-limit bucket — see `.env.example`. `saas` adds the `useAuth()` composable, login/signup pages and a global route middleware that call the API's session endpoints.

### Known deliberate asymmetry: Nuxt Layers, `starter` only

The **`starter`** template is the only one restructured into Nuxt **Layers** (`layers/<feature>/app/{pages,composables,components}` + `layers/shared/{app,api-client}`), with `imports: { scan: false }` on feature layers (the ADR §5.1/5.3 precondition for boundary lint to see real imports) and `eslint-plugin-boundaries` blocking cross-layer imports. The **other 8 cloned templates get the pass-through wiring above but NOT the Layers restructuring** — retrofitting Layers onto an externally-cloned ui.nuxt.com template's existing upstream structure risks fighting its layout, so it's intentionally skipped. This is a known, accepted gap, not an oversight.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js 22+, pnpm. Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-app` first).

---

## When not to use

This skill only ever creates a **new** project. A request about a Nuxt app that already exists belongs elsewhere — even when it names this exact stack. The pass-through, the typed API client and the templates are what this scaffold *generates*; they are not topics it owns.

- Add a page, component, or API route to an existing Nuxt app → `task-workflow`
- Fix a bug or a failing check → `debug-workflow`
- Explain how a library in the stack works → answer directly, no skill
- Implement a Figma handoff in an existing app → `nuxt-ui-figma-handoff`
- Add governance files to an already-scaffolded repo → `bigin-harness-setup`

---

## Step 1: Detect state & confirm

Check the target directory:

- **`nuxt.config.ts` exists + both signature files (`vitest.config.ts`, `.claude/settings.json`) + `node_modules/` all exist** → complete scaffold. Say so and stop.
- **`nuxt.config.ts` exists but a signature file or `node_modules/` is missing** → partial scaffold (prior failed run, or a maintainer's `skipInstall: true` run that still needs installing/verifying). Ask: *"Partial scaffold detected — resume (install the preset + apply artifacts + verify)? (yes / no)"*. If yes → set `resume: true` in the config and continue to Step 2 (theme answers are still needed for the artifact stage). If no → stop.
- **No `nuxt.config.ts`** → ask: *"Scaffold a Nuxt 4 app in this repo (non-interactive npm create nuxt@latest + the /api pass-through preset + config)? (yes / no)"*. If no → stop.

(The script re-checks all of this and fails fast rather than overwriting — but resolving it conversationally first avoids a wasted run.)

## Step 2: Gather config

`AskUserQuestion` accepts up to 4 questions in a **single** call, rendered as one widget. Prior fixes (v1.21.1, v1.21.6) tried enforcing "one call" via prose alone — a numbered 1-4 list read as "call the tool once per numbered item," and it kept regressing to 2 (or 4) separate tool invocations in the same turn, each rendering its own question list. There is no `questions.length` autosplit — the model must place all 4 objects in one `questions` array itself.

**Exactly one `AskUserQuestion` tool call, with a `questions` array holding all 4 objects below.** Not one call per item, not two calls of two — one invocation, `questions: [ {...}, {...}, {...}, {...} ]`. They don't depend on each other, so array order doesn't matter. If you find yourself about to emit a second `AskUserQuestion` tool call in this same turn, stop — fold the remaining question(s) into the first call's array instead.

1. **Template** — options: `Starter — bare pass-through, no auth` (recommended/default), `SaaS — public site + private dashboard, cookie-session auth`, `Dashboard — admin-style multi-column shell`, and a 4th option labeled `Other templates` whose **description spells out every remaining slug by name** — `landing` (marketing page), `docs` (documentation site), `portfolio` (portfolio/blog), `chat` (AI chatbot), `changelog` (GitHub-releases site), `editor` (WYSIWYG editor) — so the user knows exactly what to type before picking the tool's own "Other" free-text option. (Never add your own option literally labeled "Other" — `AskUserQuestion` adds that automatically; `Other templates` is the label that carries the descriptive list.) If the typed value isn't one of the 9 slugs, list them again and re-ask.
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
  "gitCommit": true,                 // final "chore: scaffold Nuxt 4 app" commit
  "skipInstall": false               // advanced/maintainer flag — see below; never set true from Step 2's normal flow
}
```

`skipInstall` (default `false`, not part of Step 2's questions) writes every file and merges every `package.json` entry but never runs `npm create`'s install, `pnpm add`, `pnpm simple-git-hooks`, or the verify stage — the preset packages land in `package.json` pinned to the `latest` dist-tag, unresolved. Use it only for fast maintainer iteration on `scaffold.mjs`/templates (see `references/MAINTAINING.md`); the result is not a runnable app until `pnpm install` is run manually. Never set this from the normal user-facing flow.

Then run it from the target directory, streaming output (it can take several minutes — installs + lint + type-check + tests):

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs --config <path-to-config.json>
```

Zero prompts occur once the script starts. Every step it performs (init, version refresh, preset, artifacts, hooks, verify, commit) is internal — do not duplicate any of it.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → config problem; fix the JSON per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing stage/command. Common causes: Node < 22, pnpm missing, network failure during `npm create`, or a `create-nuxt@latest` behavior change (the error will say to re-verify `references/bootstrap.md`). A failed run partway through leaves a partial scaffold — after fixing the cause, re-run with `"resume": true`.

Maintainer notes (design rationale, manual validation after changing the script or templates) live in `references/MAINTAINING.md`. A scaffold run never needs them, so it never reads them.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/` — **source of truth** for every file written/merged into the project.
- `references/bootstrap.md` — rationale for the command sequence the script executes.
- `references/artifacts.md` — rationale + merge semantics for each template.
- `references/modules.md` — core and preset modules, optional-modules menu.
