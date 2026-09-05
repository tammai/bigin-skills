# Phase 3: which `.claude/rules/` files each profile gets

Create `.claude/rules/` if it doesn't exist. **Every file below: skip if `INSTALL_MODE=new` and it already exists.**

Four of these files are the same for every profile and are described once, under [The four shared files](#the-four-shared-files). Only the conventions and testing rules differ per profile.

## Per-profile matrix

| Profile | Conventions rule file(s) | `testing.md` | `architecture.md` addendum |
|---|---|---|---|
| `nuxt` | `conventions-frontend.md` + `conventions-server.md` | yes | yes |
| `nuxt-marketing` | `conventions-frontend.md` + `conventions-content.md` | yes | yes |
| `next` | `conventions-frontend.md` + `conventions-server.md` | yes | yes |
| `go` | `conventions.md` | no | yes |
| `nodejs` | `conventions.md` | no | yes |
| `flutter` | `conventions.md` | yes | yes |
| `tauri` | `conventions-frontend.md` + `conventions-rust.md` | yes | yes |
| `generic` | none | no | **no** |

**This matrix is also `{CONVENTIONS_RULE}`.** The knowledge bundle's agent-rules concept cites the profile's conventions rule by path, so a profile whose conventions file is named differently — or absent, as on `generic` — resolves or drops that citation from the same row. See `references/knowledge-bundle.md`.

Every conventions and testing template already carries its own `paths:` frontmatter — take it verbatim from the profile file, don't substitute anything. All of them come from `references/profile-{PROFILE}.md` → the `## <filename> Template` section of the same name.

**`generic` writes no conventions and no testing rule.** There is no known stack to write conventions for; the generated `CLAUDE.md`'s "match the surrounding code" rule stands in for them. It also gets **no** architecture addendum — `references/profile-generic.md` → `## architecture addendum` explains why.

## What differs, per profile

Only the things a matrix cell can't hold:

- **`nuxt`** — `conventions-frontend.md` scopes to `app/**`; `conventions-server.md` to `server/**`. `testing.md` scopes to `tests/**` + `vitest.config.ts` and encodes the **centralized** convention: `tests/` mirrors `app/`/`server/`, cross-tree imports use the `~~/` root alias, and Nitro auto-imports are stubbed via `tests/support/`.
- **`nuxt-marketing`** — the two-file split again, but the second file is the *content* tree rather than a server: `conventions-frontend.md` scopes to `app/**`, `nuxt.config.ts`, `content.config.ts`; `conventions-content.md` to `content/**` + `i18n/**`. That second file is the profile's reason to exist and the only rule file in any profile written for a **non-developer editor** — it carries the boundary that content files and locale bundles are editable while routing, the locale set, block types, collection schemas and deploy config are not, and it treats content as untrusted input because an agent-driven editor writes it. Scoping it to those two trees is load-bearing: it is the rule that loads for a content edit and stays out of context for a code change. `testing.md` scopes to `tests/**` + `vitest.config.ts` with the same centralized tree as `nuxt`.
- **`next`** — a frontend+backend split app like nuxt, not a single-tree backend. `conventions-frontend.md` scopes to `src/app/**`, `src/components/**`, `src/hooks/**`, `src/stores/**`; `conventions-server.md` to `src/app/api/**`, `src/lib/**`, `src/proxy.ts`. `testing.md` scopes to `src/**/*.test.ts(x)` + `vitest.config.ts` and encodes the **co-located** convention — tests sit next to the source they cover, unlike nuxt's centralized tree.
- **`go` / `nodejs`** — one `conventions.md`, no testing rule.
- **`tauri`** — the nuxt/next two-file split, but the second file is the Rust shell rather than a Nitro server: `conventions-frontend.md` scopes to `app/**`, `shared/**`, `nuxt.config.ts`; `conventions-rust.md` to `src-tauri/**`. `testing.md` scopes to `tests/**`, `src-tauri/tests/**` and `vitest.config.ts` — both trees, because a Tauri app has two test runners and the rules that matter (where a regression test may live so `bugfix-test-guard.mjs` can see it, why E2E goes through the WebdriverIO service rather than `tauri-driver`) are about how the two relate.
- **`flutter`** — the go/nodejs single-`conventions.md` shape **plus** a testing rule, because the test tree is where this profile's two most expensive mistakes live: unpinned goldens and an unmigrated `schemaVersion`. `conventions.md` scopes to `lib/**`, `api/**`, `pubspec.yaml`, `analysis_options.yaml`; `testing.md` to `test/**` + `integration_test/**`, a mirrored tree like nuxt's rather than co-located like next's.

## The four shared files

Written for **every** profile, `generic` included, all from `references/files-shared.md`:

| File | Source section | Paths frontmatter |
|---|---|---|
| `security.md` | `## security.md` | **prepend** the profile's block from `## paths substitutions` |
| `architecture.md` | `## architecture.md`, then append `references/profile-{PROFILE}.md` → `## architecture addendum` (except `generic`, which gets no addendum) | **prepend** the profile's block from `## paths substitutions` |
| `comments.md` | `## comments.md`, verbatim | **none** — its frontmatter is stack-agnostic and already in the template |
| `product.md` | `## product.md`, verbatim | **none** — always scopes to `docs/product/**`, the same on every profile |

`comments.md` and `product.md` are the two to not get clever with. `comments.md` applies to any
source file, including scripts and tooling outside the app directories, which is why it carries
its own frontmatter and why `generic` gets it even though it gets no conventions rules.
`product.md` is stack-agnostic for a different reason: `docs/product/**` names no app directory
at all, so there is no profile path to substitute in. Substituting a profile's paths into either
would narrow it wrongly.
