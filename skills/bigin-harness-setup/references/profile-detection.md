# Phase 0: stack-profile detection

The full detection ladder, the three narrowing tests (Tauri before Nuxt, marketing site before Nuxt, Flutter app vs package), and the empty-repo question text.

Check for stack indicators, first match wins:
1. `src-tauri/tauri.conf.json` → profile = `tauri`. **This rung is above `nuxt` on purpose.** A Tauri desktop app with a Nuxt frontend has *both* markers, and `nuxt` matching first would onboard it as a web app: SSR left on, a `server/` BFF that does not exist at runtime, and no rule anywhere about capabilities, the IPC trust boundary, the updater key or code signing. Never reorder these two.
2. `nuxt.config.ts` or `nuxt.config.js` **plus three more conditions** → profile = `nuxt-marketing`. **This rung is above `nuxt` for the same first-match-wins reason row 1 is.** A multi-locale marketing site carries the `nuxt.config.ts` marker too, and `nuxt` matching first would write BFF-proxy, sealed-session and Pinia-Colada conventions into a repo with no BFF half, no auth and no client state worth a store — and would have no way to say the thing that actually matters here, which is that a client's content editor may change content files and locale bundles and nothing else. All four conditions are required:
   - **`nuxt.config.ts`/`.js` present** — same marker as row 3.
   - **`@nuxt/content` in `dependencies`.** `devDependencies` only is **not** a match: a site whose every page is built from a content collection declares the module as a runtime dependency, and a `devDependencies`-only entry is a docs or blog section bolted onto something else. Fall through to `nuxt`.
   - **`@nuxtjs/i18n` in `dependencies`, and a `content/` directory or `content.config.ts` present.** The positive marker for a multi-locale site built from collections.
   - **No auth marker** — neither `nuxt-auth-utils` nor `@sidebase/nuxt-auth` in `dependencies`.

   **Condition 3's marker set is unverified against the Marketing Site Factory's template.** It is what the template is believed to ship, not what it has been observed to ship. If the template declares `@nuxtjs/i18n` in `devDependencies`, or configures collections without a `content/` tree or `content.config.ts`, condition 3 fails and **every Factory site silently onboards as `nuxt`** — the exact outcome this rung exists to prevent, and one that looks like success at install time. Check it against the template before this profile is used on a real site.

   **Conditions 3 and 4 are the narrowing test**, and they are what keeps row 3 untouched: a Nuxt fullstack app that happens to ship a docs section satisfies the first two and **must** stay on `nuxt`.

   **`server/api/**` is deliberately not tested.** This profile's own two endpoints — a contact form and a newsletter signup — live in the app's `server/api/`, per the Factory's one-Worker-per-site constraint, so testing for that directory's absence would reclassify a site as `nuxt` the moment it grew a contact form: correct at install and wrong forever after. The cost is accepted and stated plainly — an auth-less fullstack app that uses both `@nuxt/content` and `@nuxtjs/i18n` and keeps a `content/` tree will match this rung, and that is rarer than a marketing site with a form. A site that takes on auth has stopped being this profile; that is a re-run of setup with the change made deliberately, never a silent reclassification.

   **The empty-repo question below is deliberately not extended to `nuxt-marketing`.** There is no scaffolder for a marketing site in this repo, and offering a choice this skill cannot scaffold is exactly the failure mode `references/profile-generic.md` names for Flutter packages. The repo this profile onboards has already been scaffolded by the Marketing Site Factory's template, so its marker file exists and Phase 0.5 is skipped for it the same way it is for any other already-scaffolded repo.
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

Type 1, 2, 3, 4, 5, or 6.
```

9. **Existing code, no marker matched** → `PROFILE = generic`. Do **not** ask and do not offer the six the question lists — an existing repo that isn't one of them won't become one, and forcing a pick writes conventions for a stack that isn't there. Say one line ("no matching stack profile — installing the stack-neutral harness") and continue to the next phase.

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content — `references/profile-generic.md` for `generic`, which states up front what that profile installs and skips.
