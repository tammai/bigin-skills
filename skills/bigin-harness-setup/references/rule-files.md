# Phase 3: which `.claude/rules/` files each profile gets

Create `.claude/rules/` if it doesn't exist. **Every file below: skip if `INSTALL_MODE=new` and it already exists.**

Three of these files are the same for every profile and are described once, under [The three shared files](#the-three-shared-files). Only the conventions and testing rules differ per profile.

## Per-profile matrix

| Profile | Conventions rule file(s) | `testing.md` | `architecture.md` addendum |
|---|---|---|---|
| `nuxt` | `conventions-frontend.md` + `conventions-server.md` | yes | yes |
| `next` | `conventions-frontend.md` + `conventions-server.md` | yes | yes |
| `go` | `conventions.md` | no | yes |
| `nodejs` | `conventions.md` | no | yes |
| `flutter` | `conventions.md` | yes | yes |
| `generic` | none | no | **no** |

Every conventions and testing template already carries its own `paths:` frontmatter — take it verbatim from the profile file, don't substitute anything. All of them come from `references/profile-{PROFILE}.md` → the `## <filename> Template` section of the same name.

**`generic` writes no conventions and no testing rule.** There is no known stack to write conventions for; the generated `CLAUDE.md`'s "match the surrounding code" rule stands in for them. It also gets **no** architecture addendum — `references/profile-generic.md` → `## architecture addendum` explains why.

## What differs, per profile

Only the things a matrix cell can't hold:

- **`nuxt`** — `conventions-frontend.md` scopes to `app/**`; `conventions-server.md` to `server/**`. `testing.md` scopes to `tests/**` + `vitest.config.ts` and encodes the **centralized** convention: `tests/` mirrors `app/`/`server/`, cross-tree imports use the `~~/` root alias, and Nitro auto-imports are stubbed via `tests/support/`.
- **`next`** — a frontend+backend split app like nuxt, not a single-tree backend. `conventions-frontend.md` scopes to `src/app/**`, `src/components/**`, `src/hooks/**`, `src/stores/**`; `conventions-server.md` to `src/app/api/**`, `src/lib/**`, `src/proxy.ts`. `testing.md` scopes to `src/**/*.test.ts(x)` + `vitest.config.ts` and encodes the **co-located** convention — tests sit next to the source they cover, unlike nuxt's centralized tree.
- **`go` / `nodejs`** — one `conventions.md`, no testing rule.
- **`flutter`** — the go/nodejs single-`conventions.md` shape **plus** a testing rule, because the test tree is where this profile's two most expensive mistakes live: unpinned goldens and an unmigrated `schemaVersion`. `conventions.md` scopes to `lib/**`, `api/**`, `pubspec.yaml`, `analysis_options.yaml`; `testing.md` to `test/**` + `integration_test/**`, a mirrored tree like nuxt's rather than co-located like next's.

## The three shared files

Written for **every** profile, `generic` included, all from `references/files-shared.md`:

| File | Source section | Paths frontmatter |
|---|---|---|
| `security.md` | `## security.md` | **prepend** the profile's block from `## paths substitutions` |
| `architecture.md` | `## architecture.md`, then append `references/profile-{PROFILE}.md` → `## architecture addendum` (except `generic`, which gets no addendum) | **prepend** the profile's block from `## paths substitutions` |
| `comments.md` | `## comments.md`, verbatim | **none** — its frontmatter is stack-agnostic and already in the template |

`comments.md` is the one to not get clever with: it applies to any source file, including scripts and tooling outside the app directories, which is why it carries its own frontmatter and why `generic` gets it even though it gets no conventions rules. Substituting a profile's paths into it would narrow it wrongly.
