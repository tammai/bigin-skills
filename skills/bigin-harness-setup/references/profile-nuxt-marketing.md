# Nuxt Marketing Profile Templates

Stack: multi-locale Nuxt 4 marketing site — `@nuxt/content` collections, `@nuxtjs/i18n`, Tailwind CSS, prerendered onto Cloudflare Workers static assets. No auth, no BFF, no database.

Detection: a **new rung above `nuxt`**, matched only when all four conditions hold — `nuxt.config.ts`/`.js` present, `@nuxt/content` in `dependencies`, `@nuxtjs/i18n` in `dependencies` with a `content/` directory or `content.config.ts` present, and no auth marker (`nuxt-auth-utils` and `@sidebase/nuxt-auth` both absent from `dependencies`). First match wins in the Phase 0 ladder, so this rung has to sit above `nuxt` for the same reason `tauri` does: a marketing site carries the `nuxt.config.ts` marker too, and `nuxt` matching first would write BFF-proxy and Pinia-Colada conventions for a repo that has no BFF half and no client state worth a store. Conditions 3 and 4 are the narrowing test — a Nuxt fullstack app that happens to ship a docs section satisfies conditions 1 and 2 and must stay on `nuxt`. **`server/api/**` is deliberately not tested**: this profile's own form and newsletter routes live there, so testing for its absence would be correct at install and wrong from the first contact form onward. Full ladder: `references/profile-detection.md`.

**Empty repo → `nuxt-marketing-scaffold` creates the app first.** The empty-repo question in `references/profile-detection.md` offers this profile as option 7, and Phase 0.5 delegates to that skill exactly as the `nuxt` profile delegates to `nuxt-scaffold`. It is a separate scaffolder on purpose: `nuxt-scaffold` installs `nuxt-auth-utils` into everything it makes, which is condition 4's auth marker, so a site built that way would detect as `nuxt` — see `references/scaffold-delegation.md`. A site that arrives already scaffolded skips Phase 0.5 like any other repo whose marker file exists.

The reason this profile exists, in one sentence: **the seven other profiles all assume a developer is the only editor.** Here a client's content editor — usually an agent acting for one — may change content files and locale bundles, and nothing else. That boundary is `conventions-content.md`, and it is the thing no other profile can express.

**Every rule below is stated here in full.** This file is the source, not a summary of one — `bigin-skills` depends on no other plugin, so a profile must never defer to a document outside this repo for the conventions it writes.

---

## Commands

```
lint:       pnpm lint
format:     pnpm lint --fix
typecheck:  pnpm type-check
test:       pnpm test --run
build:      pnpm build          # prerenders every locale into .output/public
dev:        pnpm dev
preview:    pnpm preview
```

**There is no `deploy` row, on purpose.** Deploying belongs to the site's own workflow, which the Factory owns; `wrangler.jsonc` and any `wrangler deploy` invocation are read by this profile and written by none of it. A harness that generated a deploy step would be generating the one command whose blast radius is a live client site.

**`pnpm build`, not `pnpm generate`.** With the Cloudflare Workers preset the build emits the Worker module *and* the prerendered static tree under `.output/public` — the tree the assets binding serves. The prerender is the gate that matters: a locale that silently fails to prerender is a locale that 404s in production and nowhere else, which is why CI asserts one prerendered entry point per locale bundle rather than trusting a green build.

Every file created or edited is auto-formatted by the Nuxt ESLint module via the `PostToolUse` hook in `.claude/settings.json` (`.claude/guards/lint-fix-file.mjs`, ESLint `--fix` scoped to the touched file). `pnpm lint --fix` above is the manual, whole-repo command.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Nuxt 4 marketing site · @nuxt/content collections · @nuxtjs/i18n · Tailwind
Deploy: prerendered onto Cloudflare Workers static assets — the deploy workflow is not in this repo
Runtime: Node ≥22 · pnpm only
There is no auth, no database and no BFF here. If a task seems to need one, it is the wrong repo.

## Commands
| Purpose   | Command            |
|-----------|--------------------|
| dev       | `pnpm dev`         |
| build     | `pnpm build`       |
| preview   | `pnpm preview`     |
| test      | `pnpm test --run`  |
| lint      | `pnpm lint`        |
| format    | `pnpm lint --fix`  |
| typecheck | `pnpm type-check`  |

## Rules
See `.claude/rules/` — path-scoped conventions (frontend and content), testing, security, architecture.

## Hard Rules (non-negotiable)
- **Content and locale bundles are editable; the shape of the site is not.** `content/**` and `i18n/locales/**` are open. Routing, the locale set, block types, collection schemas and deploy config are closed to a content change — those are code edits with a `PLAN.md`. Rules: `.claude/rules/conventions-content.md`.
- **A locale's missing or unreviewed content is hidden, never substituted from another locale.** No `fallbackLocale` anywhere in the i18n config — the pre-commit gate greps for that one string, because it is the single setting that contradicts this rule.
- **No colour, type, spacing or motion literal outside the generated token set.** No hex, no `rgb()`/`rgba()` in the component or block trees; the gate greps for both.
- **No raw `<img>`** outside `app/components/media/` — everything else uses those wrappers, so every image gets sizing and a format ladder.
- **Content is untrusted input.** It is schema-validated at build by its collection schema, and never rendered as raw HTML without sanitising. An agent-driven editor writes it.
- Nuxt ESLint auto-formats every file you create or edit (PostToolUse hook). Never disable it.
- No `--no-verify`. No `eslint-disable`, `@ts-ignore` or `as any` without a comment saying why the rule is wrong here.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Every bug fix ships a regression test that fails before the fix (`bugfix-test-guard.mjs`).

## Task workflow
Non-trivial features: /task-workflow. Bugs: /debug-workflow. Review: /code-review, /security-review.
```

---

## conventions-frontend.md Template

Paths frontmatter scopes this file to the app tree and the two config files that define the site's shape.

```markdown
---
paths:
  - "app/**"
  - "nuxt.config.ts"
  - "content.config.ts"
---
# Frontend Conventions (marketing site)

## What this frontend is not
There is no session, no store of server state and no client-side data fetching against a remote origin. Every page is prerendered at build time from a content collection. `server/api/` exists for exactly two things — a contact form and a newsletter signup — and for nothing else: every Nuxt answer that reaches for `nuxt-auth-utils`, a BFF proxy route or a Pinia Colada query is wrong in this repo, and wrong in a way that passes `pnpm dev` because the dev server resolves data a prerendered page never will.

## The three layers, and the one-way arrow
`content/**` → `app/pages/**` → `app/components/blocks/**`.

- **Pages** are the only place `queryCollection()` is called. A page resolves its content entry, then renders blocks from it.
- **Blocks never query content.** A block takes typed props and renders them. This is the boundary that makes a block reusable across collections and testable without a content fixture — and the one that breaks first, because calling the query inside the block is always the shorter diff.
- Anything a block needs that is not in its props is a missing prop, not a reason to reach for the query.

## Naming
- Components: PascalCase (`PricingTable.vue`). Blocks live in `app/components/blocks/` and are named for the block type they render, matching the discriminator in the collection schema.
- Composables: camelCase with `use` (`useLocalePath.ts` is the module's; yours go in `app/composables/`).
- Media wrappers: `app/components/media/`. The only place a raw `<img>` tag is written.

## Tokens are the only source of visual values
- Colour, type scale, spacing and motion come from the generated token set (Tailwind theme + CSS custom properties). No hex literal, no `rgb()`/`rgba()`, no hand-picked pixel value in a component or a block.
- A value the tokens cannot express is a token change, made once in the token source, not an inline literal in one component. The pre-commit gate greps for hex and `rgb()` under the component and block trees; a genuine exception (a third-party embed's required colour) is marked `token-ok` on the same line.

## Images
- `<NuxtImg>` / `<NuxtPicture>` through the wrappers in `app/components/media/` — never a bare `<img>` elsewhere. Width and height are always set; a marketing page's layout shift is measured by whoever is paying for the traffic.
- Decorative images take an empty `alt`; content images take their `alt` from the content entry, so it is translatable.

## i18n
- Every user-visible string is either content (in `content/**`) or a key in `i18n/locales/<code>.json`. No literal copy in a component, in either language.
- Links use the locale-aware helpers, never a hand-built `/${locale}/...` path — the URL strategy is config, and hand-built paths silently survive a strategy change.
- **No `fallbackLocale`.** A key or entry missing for a locale renders nothing and the surrounding block hides itself; it is never filled from the default locale. Half-translated pages that look finished are the failure this rule exists to prevent.

## Formatting
ESLint via `@nuxt/eslint` only. Prettier disabled. Auto-fixed on save via the PostToolUse hook.
```

---

## conventions-content.md Template

**This is the profile's reason to exist.** Paths frontmatter scopes it to the two trees a content editor may change, so it is the rule file that loads when one is being edited and the one that does not load for a code change.

```markdown
---
paths:
  - "content/**"
  - "i18n/**"
---
# Content Conventions

## What a content change may touch
Editable: files under `content/**`, and the locale bundles under `i18n/locales/**`.

Closed to a content change — each of these is a code edit with its own `PLAN.md`, even when the diff looks like content:
- **Routing** — the route map, slugs already published, the URL strategy.
- **The locale set** — adding or removing a locale is a build, deploy and SEO change, not a new file.
- **Block types** — a new kind of block is a component plus a schema change, never a hand-written key the renderer does not know.
- **Collection schemas** — `content.config.ts`.
- **Deploy config** — `wrangler.jsonc`, the workflow, anything that decides where the site goes.

If a content task cannot be done without one of the five, it is not a content task. Say so and stop rather than widening the edit.

## A schema and the content written against it change together
A collection schema and the entries validated by it are one change, in one commit. A schema field added without the entries is a build that fails on every existing file; entries written against a field the schema does not have are silently dropped at build and the page renders a gap. Neither half is shippable alone.

## Content is untrusted input
An agent-driven editor writes these files, so treat them the way you would treat a request body:
- **Schema-validated at build.** Every collection has a schema, and it is the validation — not a runtime check in a component, and not a reviewer's eye. A field the schema does not declare is not "extra", it is unvalidated.
- **Never rendered as raw HTML unsanitised.** No `v-html` on a content value, and no raw-HTML passthrough in the markdown pipeline, without sanitising first. A content file is the shortest path from an editor to a script tag on a client's domain.
- **No secret, token, key or internal URL in a content file.** These files are public by construction — they are prerendered into the shipped bundle.
- Front matter that decides *behaviour* (a redirect target, an embed URL, a script src) is an allowlist decision in code, not a free-text field.

## Missing content is hidden, never substituted
An entry a locale does not have, or has but has not had reviewed, renders nothing: the block hides itself and the page renders without it. It is never filled from the default locale, and never machine-filled. `fallbackLocale` is absent from the i18n config and the pre-commit gate greps for it.

## Locale bundles
- One file per locale, `i18n/locales/<code>.json`. Keys are added in the default locale first; a key missing elsewhere renders nothing, which is the intended behaviour, not a bug to paper over.
- Keys are namespaced by the surface they serve. Never reuse a key across two surfaces to save a line — the second surface's copy change then silently edits the first.
- A key removed from the default locale is removed from every locale in the same commit.
```

---

## testing.md Template

```markdown
---
paths:
  - "tests/**"
  - "vitest.config.ts"
---
# Testing Conventions

## Location
Tests live under `tests/`, mirroring the source tree — never co-located with source.
- `app/components/blocks/PricingTable.vue` → `tests/app/components/blocks/PricingTable.test.ts`
- `app/utils/foo.ts` → `tests/app/utils/foo.test.ts`

`vitest.config.ts`'s `test.include` is scoped to `tests/**/*.test.ts` — a stray `*.test.ts` next to source silently won't run. Cross-tree imports use the `~~/` root alias, never relative paths.

## What is worth testing here
| Layer | What | How |
|---|---|---|
| collection schemas | a valid entry parses; a missing required field fails; an unknown block type fails | the schema directly, no Nuxt runtime needed |
| blocks | one test per block: renders its props, and renders nothing when the optional ones are absent | Vitest + Testing Library, props passed directly — never a content query |
| pages | resolves its entry and renders the blocks in order | the collection query stubbed at its boundary |
| i18n | every key present in the default locale; no key present *only* outside it | a test over the bundle files, not a rendered page |
| prerender | every locale has a prerendered entry point | the CI build step, not a unit test |

## Rules
- **Blocks are tested with props, never with a content fixture from disk.** A block that needs a fixture is a block that queries content, which the frontend conventions forbid — the test failing to compile is the boundary working.
- **A missing translation is a passing test, not a failing one.** The assertion is that the block hides itself. Any test that asserts default-locale copy appearing under another locale is asserting the bug this profile exists to prevent.
- Fixtures for schema tests are written inline in the test, not copied out of `content/**` — a copied fixture keeps passing after the schema moves.
- Cover the negative cases directly: an entry missing a required field, an unknown block type, a locale bundle missing a key, an image with no dimensions, a content value containing HTML.
```

---

## architecture addendum

Prepend `paths: ["app/**", "content/**", "i18n/**", "content.config.ts"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Nuxt Marketing] Four Boundaries Every Site Inherits

**1. content → pages → blocks, and blocks never query content.**
`queryCollection()` is called in pages only. A block takes typed props. The arrow is one-way, and it is what makes a block reusable across collections and testable without a content fixture. Reaching for the query inside a block is always the shorter diff and always the wrong one — the prop it wanted is the change to make.

**2. `server/api/` holds forms and newsletter, and nothing else.**
Every page is prerendered static assets: there is no request-time server for a page. The two exceptions are a contact form and a newsletter signup, and they live in this app's own `server/api/` — **one Worker per site**, never a second deployable, because that is the Factory's Cloudflare constraint. A route there that is not one of those two is a BFF creeping in, and belongs on the `nuxt` profile instead. Three things are requirements on the form routes, not suggestions: **Turnstile verification** of every submission, **rate limiting** per IP and per form, and **payload validation** against a declared schema before anything is read. A form endpoint with two of the three is an open relay for whoever finds it.

**3. No colour, type, spacing or motion literal outside the generated token set.**
The tokens are the design system's only interface into this repo. A value they cannot express is a token change made once at the source, never an inline literal in one component. Enforced by grep in the pre-commit gate and CI, because it is a fact about strings rather than about a syntax tree.

**4. A locale's missing content is hidden, never filled from the default locale.**
No `fallbackLocale`, anywhere. A missing entry or key renders nothing and the surrounding block hides itself. A page that looks finished in a language nobody has written is worse than a page with a section missing: the first ships untranslated copy to a client's customers and nothing reports it.
```

---

## Commit-time gates

Three greps, in `scripts/pre-commit.sh` and in CI. None is expressible as a lint rule, because each is about a string or a path rather than a syntax tree. Full script: `references/hook-guard.md` → `## pre-commit: nuxt-marketing`.

- **No hex or `rgb()` colour literal** under the component and block trees. Escape hatch `token-ok` on the same line, for a third-party embed that mandates a colour.
- **No `fallbackLocale`** in the i18n config. One string that exactly contradicts hidden-not-substituted; there is no legitimate reason for it in this repo and therefore no escape hatch.
- **No raw `<img`** outside `app/components/media/`. Escape hatch `img-ok` on the same line.

The gate is written **even when a hook manager already exists** and chained behind it, the same call `tauri` makes and for the same reason: the Factory's template ships `simple-git-hooks` → `pnpm lint-staged`, which runs ESLint over staged files and none of the three greps above. See `references/overlay-matrix.md` → `## 5-1`.

---

## settings.json Template

Governance superset: `permissions` plus the five `PreToolUse` guards, the two `PostToolUse` entries (lint-fix and the injection scan), `SessionStart`, `PreCompact`, `SessionEnd` and `Setup`. `wrangler deploy` is deliberately absent from the allowlist — deploying is the Factory's workflow, and a pre-approved deploy command is a live client site one tool call away. `pnpm add`/`remove` are allowed; `pnpm up` is not, since it rewrites the lockfile the build gate depends on.

Also write `.claude/guards/lint-fix-file.mjs` if it is missing — script body from `skills/nuxt-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs`, the single source of truth for it.

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm dev:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm preview:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm type-check:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(npx nuxi:*)",
      "Bash(pnpm add:*)",
      "Bash(pnpm remove:*)",
      "Bash(pnpm install:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bash-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/commit-msg-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|WebFetch|mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-gate-guard.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/lint-fix-file.mjs"
          }
        ]
      },
      {
        "matcher": "WebFetch|mcp__.*|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-scan-guard.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/canary-seed.mjs"
          },
          {
            "type": "command",
            "command": "node .claude/guards/session-resume-check.mjs"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ],
    "Setup": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/install-hooks.mjs"
          }
        ]
      }
    ]
  }
}
```

---

## .vscode/settings.json Template

Editor format-on-save through the ESLint extension — the same block as `references/profile-nuxt.md` → `## .vscode/settings.json Template`. Merge into an existing `.vscode/settings.json` rather than overwriting.

```json
{
  "prettier.enable": false,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "dbaeumer.vscode-eslint",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```
