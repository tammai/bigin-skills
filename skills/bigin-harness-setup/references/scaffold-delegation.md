# Scaffold Delegation (Phase 0.5)

One deterministic script per profile owns creating the app; this skill only overlays governance on top. Nothing here is conversational — the script runs unattended, and this skill writes no project files while it does.

---

## Which script, and what it needs

| Profile  | Fires when the repo has no | Delegate to       | Invocation  | That skill's own decisions to gather (its Step 2)          |
| -------- | -------------------------- | ----------------- | ----------- | ---------------------------------------------------------- |
| `nuxt`   | `nuxt.config.ts`           | `nuxt-scaffold`   | config JSON | project name, primary/neutral theme colors, version policy |
| `next`   | `next.config.*`            | `next-scaffold`   | config JSON | project name, template, version policy                     |
| `go`     | `go.mod`                   | `go-scaffold`     | CLI flags   | module path, project name                                  |
| `nodejs` | `package.json`             | `nodejs-scaffold` | CLI flags   | project name                                               |
| `flutter`| `pubspec.yaml`             | `flutter create`  | CLI flags   | project name (snake_case), org (reverse-domain), platforms |

**Config-JSON profiles** (`nuxt`, `next`) — write the JSON (schema in that skill's `SKILL.md` → Step 3) to a temp file **outside** the repo, with `"packageManager": "pnpm"`, then:

```sh
node skills/nuxt-scaffold/scripts/scaffold.mjs --config <path>
node skills/next-scaffold/scripts/scaffold.mjs --config <path>
```

**Flag profiles:**

```sh
node skills/go-scaffold/scripts/scaffold.mjs --module <module-path> --dir . [--project <name>]
node skills/nodejs-scaffold/scripts/scaffold.mjs --project <name> --dir .
```

**`flutter` delegates to the stack's own CLI, not to a skill in this plugin** — there is no `flutter-scaffold`. Pin every argument so the run is deterministic and prompt-free:

```sh
flutter create --project-name <snake_case_name> --org <com.example> --platforms=ios,android --empty .
```

- `--project-name` is mandatory here even though `flutter create` can infer it: it infers from the directory name, which fails or silently mangles anything that isn't a valid Dart identifier (a `-` in the repo name is the common case).
- `--org` sets the bundle/application ID prefix, and changing it later is a store-identity change, not a rename. Take it from the project's ADR; never default it to `com.example`.
- `--platforms=ios,android` keeps `web`/`desktop` scaffolding out of a mobile client. Add one deliberately later rather than deleting three directories now.
- `--empty` skips the counter-app sample. The sample is not a starting point for a real app and every line of it gets deleted.

**What this does *not* do, and why it isn't a defect:** no flavors and no native flavor half, no state layer, no local store, no generated API client, no `analysis_options.yaml` boundary rules. Those are exactly the decisions the project's architecture ADRs make (state default vs alternate, boundary enforcement by lint vs separate packages, offline policy per feature), so freezing them into a scaffold script today would pre-empt a decision the pipeline owns. `references/profile-flutter.md` writes the *conventions* for them, and the first slice writes the code — the generated gates skip the not-yet-configured lint plugins by name rather than failing on day one. A `flutter-scaffold` skill is the follow-up that closes this, once those defaults have been made twice.

---

## Procedure — identical for all five profiles

1. **Gather every decision now**, in one turn, back-to-back: that profile's row above, then Phase 1.5's bundle (Knowledge Bundle/Graphify + CI config + model routing profile — an empty repo can't hit Phase 1's existing-harness conflict, so only those three apply). Confirm the summary once. Store `KNOWLEDGE_BUNDLE` / `GRAPH` / `CI_PROVIDER` / `MODEL_ROUTING` now; Phase 1.5 is a no-op later on this branch.
2. **Run the command and stream its output.** Several minutes for `nuxt`/`next` (installs + verify gates), roughly a minute for `go` (first run downloads/builds `oapi-codegen`), a couple for `nodejs`.
3. **Exit 0** = scaffolded, verified, committed → set `SCAFFOLDED = true`. **Non-zero** → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand. `flutter create` is the exception on both halves: it verifies nothing and commits nothing, so exit 0 means "files exist, uncommitted" — check `pubspec.yaml` is present, then let Phase 5-1b's `git rev-parse` handle the repo (`git init` if `flutter create` didn't) and let the harness install be the first commit.

No GitHub template clone, no embedded skill copy. Skip this phase entirely for a profile whose marker file already exists — that's onboarding an existing repo, not scaffolding.

---

## What each scaffold leaves behind (Phase 1 reconciliation)

Treat everything listed as pre-existing — never clobber it. The governance overlay reconciles with it rather than replacing it.

| Profile  | Brings                                                                                                                   | `.claude/` state                                                                | Pre-commit                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------- |
| `nuxt`   | `nuxt.config.ts`, `app/`, `server/`, `eslint.config.mjs`, `.vscode/settings.json`                                        | `settings.json` (permissions + `PostToolUse` lint-fix) and `guards/lint-fix-file.mjs` | `simple-git-hooks` → `pnpm lint-staged` |
| `next`   | `next.config.ts`, `src/app/`, `components.json`, `.vscode/settings.json`                                                  | same as `nuxt`                                                                  | same as `nuxt`                         |
| `go`     | `go.mod`, `main.go`, `openapi.yaml`, `api/`, `handlers/`, `middleware/`, `models/`, `config/`, `utils/`, `migrations/`, `Makefile`, `.air.toml`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, initial commit | **none**                                                                        | none                                   |
| `nodejs` | `package.json`, `src/`, `drizzle/`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, initial commit | **none**                                                                        | none                                   |
| `flutter`| `pubspec.yaml`, `lib/main.dart`, `test/`, `ios/`, `android/`, `analysis_options.yaml` (bare `flutter_lints`), `.gitignore`, `.metadata` — **no commit** | **none**                                                                        | none                                   |

- **`nuxt` / `next`** — `.claude/settings.json` already exists, so Phase 5-3's nuxt/next branch merges the governance guards into it per-event. Never replace or duplicate the existing `lint-fix-file.mjs` `PostToolUse` entry. Don't overwrite the scaffold's `.vscode/settings.json` or its pre-commit setup either — overlay additively.
- **`flutter`** — no `.claude/` anything exists either, and two things differ from `go`/`nodejs`: nothing is committed (see step 3 above), and `analysis_options.yaml` already exists carrying only `include: package:flutter_lints/flutter.yaml`. Treat it as pre-existing — the `plugins:` section with the boundary rules is app configuration the first slice adds, not something the governance overlay writes.
- **`go` / `nodejs`** — no `.claude/` anything exists, so there's no partial-guardrail merge to do: continue through Phases 2 onward on the normal go/nodejs branches. Their `.github/workflows/ci.yml` is handled by Phase 5.6's own pre-existence check, the same as any other already-there CI file — no special-casing.
- Neither `nuxt-scaffold` nor `next-scaffold` writes a `CLAUDE.md` (governance is this skill's job), so Phase 2 always writes it fresh on a scaffolded repo.
