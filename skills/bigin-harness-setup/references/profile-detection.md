# Phase 0a: repo-type detection

Runs before the stack ladder. Six suffixes, matched on the repo's own name lowercased — the `origin` remote's repo name if there is one, else the directory basename. The remote is preferred because a locally renamed or freshly cloned directory is the case that misleads.

| Name ends in | `REPO_TYPE` | Effect on Phase 0 |
|---|---|---|
| `-specs` | `specs` | short-circuits it — `PROFILE = specs` |
| `-contracts` | `contracts` | short-circuits it — `PROFILE = contracts` |
| `-qa` | `qa` | short-circuits it — `PROFILE = qa` |
| `-api` | `api` | none; the stack ladder runs as today |
| `-web` | `web` | none; the stack ladder runs as today |
| `-mobile` | `mobile` | none; the stack ladder runs as today |
| anything else | `none` | none; say nothing |

The suffix must follow a hyphen after something: `acme-api` matches, a repo named just `api` does not. The prefix is the project slug and the standard requires it, so a bare name is more likely a coincidence than a member of a project. A user who says "this is the api repo" outright overrides detection — take them at their word.

## The confirmation

Shown **only** when a suffix matched. A repo with no suffix produces no output at all: that is the overwhelmingly common case, and a question there would tax every ordinary harness run for a standard most repos are not in.

```
This looks like the `web` repo of a polyrepo project (from the name `acme-web`).
That installs the consumer overlay: the vendored API spec becomes read-only, edits to it
are blocked in-session, and session start reports whether the contract is behind.

Right? (yes / no / a different type: specs, contracts, api, web, mobile, qa)
```

`no` sets `REPO_TYPE = none` and the run proceeds as an ordinary single repo. This confirmation is the entire safety margin on a name-based signal, so it is never skipped and never defaulted through.

## When the name and the markers disagree

A repo whose name says `specs`, `contracts` or `qa` but which carries a stack marker (`nuxt.config.ts`, `go.mod`, `pubspec.yaml`, …) is a contradiction: one of the two signals is wrong. **Do not short-circuit silently.** Say what was found on both sides and ask which is true:

```
The name says this is the `specs` repo, but I found `go.mod` — a specs repo holds no code.
Which is right: the name (install the specs profile, ignore the Go app) or the marker
(this is an ordinary Go repo that happens to be named that way)?
```

There is no conflict for `api`/`web`/`mobile`, which expect a stack marker. A `-mobile` repo that narrows to `generic` (a Flutter *package*, per row 7) is not a conflict either — it keeps `REPO_TYPE = mobile` and gets the consumer overlay, which is about contracts rather than widgets.

## Recording it

Two records, because they answer different questions:

- The generated `CLAUDE.md`'s stack line names it (`Stack: Nuxt 4 BFF app · polyrepo repo type: web`), so every session sees it without a lookup.
- `api-contract.lock` at the repo root is the machine signal a consumer repo exists at all, and is what `contract_sync.mjs` and the guards key on.

On a re-run, read the `CLAUDE.md` line first and the lock second; ask again only if neither is there and the name still matches a suffix.

---

# Phase 0: stack-profile detection

The full detection ladder, the three narrowing tests (Tauri before Nuxt, marketing site before Nuxt, Flutter app vs package), and the empty-repo question text.

Check for stack indicators, first match wins:
1. `src-tauri/tauri.conf.json` → profile = `tauri`. **This rung is above `nuxt` on purpose.** A Tauri desktop app with a Nuxt frontend has *both* markers, and `nuxt` matching first would onboard it as a web app: SSR left on, a `server/` BFF that does not exist at runtime, and no rule anywhere about capabilities, the IPC trust boundary, the updater key or code signing. Never reorder these two.
2. `nuxt.config.ts` or `nuxt.config.js` **plus three more conditions** → profile = `nuxt-marketing`. **This rung is above `nuxt` for the same first-match-wins reason row 1 is.** A multi-locale marketing site carries the `nuxt.config.ts` marker too, and `nuxt` matching first would write BFF-proxy, sealed-session and Pinia-Colada conventions into a repo with no BFF half, no auth and no client state worth a store — and would have no way to say the thing that actually matters here, which is that a client's content editor may change content files and locale bundles and nothing else. All four conditions are required:
   - **`nuxt.config.ts`/`.js` present** — same marker as row 3.
   - **`@nuxt/content` in `dependencies`.** `devDependencies` only is **not** a match: a site whose every page is built from a content collection declares the module as a runtime dependency, and a `devDependencies`-only entry is a docs or blog section bolted onto something else. Fall through to `nuxt`.
   - **`@nuxtjs/i18n` in `dependencies`, and a `content/` directory or `content.config.ts` present.** The positive marker for a multi-locale site built from collections.
   - **No auth marker** — neither `nuxt-auth-utils` nor `@sidebase/nuxt-auth` in `dependencies`.

   **Condition 3's marker set is what `nuxt-marketing-scaffold` emits**, so the rung is verified against a repo this plugin can produce rather than against an assumption about someone else's template: `@nuxtjs/i18n` in `dependencies`, and both a `content/` tree and a `content.config.ts`. A site scaffolded any other way must meet the same four conditions to be detected — if it declares `@nuxtjs/i18n` in `devDependencies`, or configures collections without either marker, condition 3 fails and it onboards as `nuxt`.

   **Conditions 3 and 4 are the narrowing test**, and they are what keeps row 3 untouched: a Nuxt fullstack app that happens to ship a docs section satisfies the first two and **must** stay on `nuxt`.

   **`server/api/**` is deliberately not tested.** This profile's own two endpoints — a contact form and a newsletter signup — live in the app's `server/api/`, per the Factory's one-Worker-per-site constraint, so testing for that directory's absence would reclassify a site as `nuxt` the moment it grew a contact form: correct at install and wrong forever after. The cost is accepted and stated plainly — an auth-less fullstack app that uses both `@nuxt/content` and `@nuxtjs/i18n` and keeps a `content/` tree will match this rung, and that is rarer than a marketing site with a form. A site that takes on auth has stopped being this profile; that is a re-run of setup with the change made deliberately, never a silent reclassification.

   **The empty-repo question below offers this profile**, because `nuxt-marketing-scaffold` can create one — the condition `references/profile-generic.md` sets for offering a choice at all. An already-scaffolded marketing site still reaches this rung by its markers and skips Phase 0.5 like any other repo whose marker file exists.
3. `nuxt.config.ts` or `nuxt.config.js` → profile = `nuxt`
4. `go.mod` → profile = `go`
5. `package.json` with express/fastify/hono/koa in dependencies → profile = `nodejs`
6. `next.config.ts`, `next.config.js`, or `next.config.mjs` → profile = `next`
7. `pubspec.yaml` → profile = `flutter`, **but only if it is a Flutter *app*.** Two checks, both needed:
   - **Is it Flutter at all?** A top-level `flutter:` key, or `flutter:` with `sdk: flutter` under `dependencies:`. A plain Dart package (a CLI, a server, a shared library) has neither — fall through to `generic` rather than writing widget conventions for a package with no widgets.
   - **Is it an app rather than a library?** An app has a runnable entrypoint and native host directories: `lib/main*.dart` plus `android/app/` or `ios/Runner/`. A **plugin** declares `plugin:` under its `flutter:` key; a **package** has neither the `plugin:` key nor the native app directories. Both are Flutter and neither is this profile — flavors, three entrypoints, a dio client and a local database are all app concerns, and a widget library that inherits them gets rules for code it will never contain. Fall through to `generic` for both, and say which one you detected so the choice is visible.
8. **Empty repo** (no source files, no manifest of any kind) → ask, since the answer picks the scaffold Phase 0.5 runs:

```
Which stack profile?
1. nuxt   — Nuxt 4 fullstack (Cloudflare Pages): Nuxt UI, Pinia + Colada, VueUse, nuxt-auth-utils, Vitest, Zod — BFF proxy layer, no direct DB access
2. go     — Go REST API backend
3. nodejs — Node.js TypeScript REST API backend
4. next   — Next.js App Router fullstack (Vercel): shadcn/ui, Zustand, TanStack Query, iron-session, Vitest, Zod — BFF proxy layer, no direct DB access
5. flutter — Flutter mobile client against an existing HTTP API: Riverpod, go_router, Drift, generated dio client — the API is frozen input, not a decision made here
6. tauri  — Tauri 2 desktop app against an existing HTTP API: Nuxt 4 SPA frontend, Rust shell owning HTTP, tokens and the local cache — the webview makes no network call
7. nuxt-marketing — multi-locale Nuxt 4 marketing site (Cloudflare Workers): @nuxt/content collections, @nuxtjs/i18n, Tailwind, fully prerendered — no auth, no BFF, no database

Type 1, 2, 3, 4, 5, 6, or 7.
```

9. **Existing code, no marker matched** → `PROFILE = generic`. Do **not** ask and do not offer the seven the question lists — an existing repo that isn't one of them won't become one, and forcing a pick writes conventions for a stack that isn't there. Say one line ("no matching stack profile — installing the stack-neutral harness") and continue to the next phase.

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content — `references/profile-generic.md` for `generic`, which states up front what that profile installs and skips.
