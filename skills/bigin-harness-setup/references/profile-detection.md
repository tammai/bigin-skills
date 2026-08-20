# Phase 0: stack-profile detection

The full detection ladder, the two-stage Flutter test, and the empty-repo question text.

Check for stack indicators, first match wins:
1. `nuxt.config.ts` or `nuxt.config.js` → profile = `nuxt`
2. `go.mod` → profile = `go`
3. `package.json` with express/fastify/hono/koa in dependencies → profile = `nodejs`
4. `next.config.ts`, `next.config.js`, or `next.config.mjs` → profile = `next`
5. `pubspec.yaml` → profile = `flutter`, **but only if it is a Flutter *app*.** Two checks, both needed:
   - **Is it Flutter at all?** A top-level `flutter:` key, or `flutter:` with `sdk: flutter` under `dependencies:`. A plain Dart package (a CLI, a server, a shared library) has neither — fall through to `generic` rather than writing widget conventions for a package with no widgets.
   - **Is it an app rather than a library?** An app has a runnable entrypoint and native host directories: `lib/main*.dart` plus `android/app/` or `ios/Runner/`. A **plugin** declares `plugin:` under its `flutter:` key; a **package** has neither the `plugin:` key nor the native app directories. Both are Flutter and neither is this profile — flavors, three entrypoints, a dio client and a local database are all app concerns, and a widget library that inherits them gets rules for code it will never contain. Fall through to `generic` for both, and say which one you detected so the choice is visible.
6. **Empty repo** (no source files, no manifest of any kind) → ask, since the answer picks the scaffold Phase 0.5 runs:

```
Which stack profile?
1. nuxt   — Nuxt 4 fullstack (Cloudflare Pages): Nuxt UI, Pinia + Colada, VueUse, nuxt-auth-utils, Vitest, Zod — BFF proxy layer, no direct DB access
2. go     — Go REST API backend
3. nodejs — Node.js TypeScript REST API backend
4. next   — Next.js App Router fullstack (Vercel): shadcn/ui, Zustand, TanStack Query, iron-session, Vitest, Zod — BFF proxy layer, no direct DB access
5. flutter — Flutter mobile client against an existing HTTP API: Riverpod, go_router, Drift, generated dio client — the API is frozen input, not a decision made here

Type 1, 2, 3, 4, or 5.
```

7. **Existing code, no marker matched** → `PROFILE = generic`. Do **not** ask and do not offer the five above — an existing repo that isn't one of them won't become one, and forcing a pick writes conventions for a stack that isn't there. Say one line ("no matching stack profile — installing the stack-neutral harness") and continue to the next phase.

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content — `references/profile-generic.md` for `generic`, which states up front what that profile installs and skips.

