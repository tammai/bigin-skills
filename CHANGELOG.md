# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-06-21

### Changed

- **Go backend stack:** Switched the HTTP router from `chi` to **Gin** (`github.com/gin-gonic/gin`) across `references/backend-go.md`, `references/scaffold.md`, and `references/agent-roles.md`
  - `backend-go.md`: rewritten `main.go`, handler, testing sections for Gin (`*gin.Context`, `c.JSON`, `c.Param`); added new sections for **Request binding & validation** (`c.ShouldBindJSON` + `binding:"..."` tags), **Route Registration** (`r.Group("/api/v1")`), and **Middleware Pattern** (`gin.HandlerFunc` + `c.Next()`/`c.AbortWithStatusJSON`)
  - `scaffold.md`: `cmd/server/main.go` now uses `gin.Default()` + `r.Run()`; added `internal/middleware/` to the created-directories list
  - `agent-roles.md`: `backend-dev` stack knowledge updated to Gin (routing, binding, `c.Request.Context()`); `qa` testing note now mentions `gin.SetMode(gin.TestMode)` + `r.ServeHTTP(w, req)`
  - Service/repository layers and project layout are unchanged (framework-agnostic)
- **Version:** Bumped to `1.8.0`

---

## [1.7.0] - 2026-06-21

### Removed

- **Skill manifest:** Removed `vue`, `vue-best-practices`, `vue-testing-best-practices`, and `github-actions` from the Phase 5 install list for both Nuxt types (Fullstack MVP and SPA Frontend)
  - Fullstack MVP: 16 → 12 skills (10 base + drizzle optional + nuxt-auth-utils optional)
  - SPA Frontend: 14 → 10 skills (9 base + nuxt-auth-utils optional)

### Changed

- **Session handoff:** Standardized `SESSION.md` location to `.claude/memory/SESSION.md` (project-relative) across `session-handoff/SKILL.md` and `CLAUDE.md` — previously inconsistent (`~/.claude/memory/`, `~/.claude/projects/<project-id>/memory/`)
- **Version:** Bumped to `1.7.0`

### Fixed

- **CHANGELOG.md:** Removed duplicate `[1.6.0]` entry that appeared twice
- **spa-frontend.md:** Added missing `runtimeConfig.public.apiBase` to the canonical `nuxt.config.ts` — the spec referenced `useRuntimeConfig().public.apiBase` without defining it
- **SKILL.md:** Phase 5 summary table was missing `session-handoff` for all project types — added to all three
- **README.md:** Plugin structure diagram listed library skill directories (`nuxt/`, `pinia/`, etc.) that do not exist in this repo — corrected to show only `bigin-webapp-harness/` and `session-handoff/`; renamed "Bundled Skills" heading to "Skills Installed at Harness-Time"

---

## [1.6.0] - 2026-06-21

### Added

- **Scaffold refactor:** Nuxt projects (Types 1 & 2) now use `pnpm create nuxt@latest . --template ui --packageManager pnpm --no-gitInit --no-install` instead of manual file writing
- **Scaffold:** `pnpm install` now runs automatically for Nuxt projects — projects are ready to develop immediately after scaffold
- **Scaffold:** Customization prompt now asks for app name, primary color, neutral color, and font before scaffold runs
- **Scaffold:** New config files added to all Nuxt projects:
  - `vitest.config.ts` — Vitest configuration with Nuxt test environment
  - `.vscode/settings.json` — ESLint as default formatter, format on save
  - `.editorconfig` — Consistent editor settings (2 spaces, LF, UTF-8)
- **Scaffold:** Git hooks now added to all Nuxt projects:
  - `simple-git-hooks` — Pre-commit hook for linting
  - `lint-staged` — Run ESLint on staged `.ts`, `.vue`, `.js`, `.mjs` files
- **Scaffold:** New devDependencies for all Nuxt types:
  - `@vitest/coverage-v8` — V8 coverage provider for Vitest
- **Dependencies:** `github-actions` skill added to Phase 5 install list for both Nuxt types (was missing from inline summary)

### Changed

- **Scaffold:** `nuxt.config.ts` template for Fullstack MVP now explicitly includes `ssr: false` (was accidentally removed in refactor)
- **Scaffold:** Step 3 now explicitly states that nuxi-generated files must be overwritten if scaffold.md lists them
- **SKILL.md:** Phase 3.5 rules updated to clarify that nuxi-generated files are replaced, not preserved
- **SKILL.md:** Phase 3.5 now references the "Announce" block in scaffold.md instead of hardcoding a file list
- **SKILL.md:** Phase 0 empty repo message updated to reflect automatic package installation
- **CLAUDE.md:** Added scaffold rules explaining the nuxi init approach, customization prompt, and auto-install
- **Version:** Bumped to `1.6.0`

### Fixed

- **SKILL.md Phase 3.5:** Contradictory rule "Do NOT run pnpm install" — corrected to require auto-install for Nuxt types
- **scaffold.md:** Fullstack MVP `nuxt.config.ts` was missing `ssr: false` — restored to match canonical spec in `fullstack-mvp.md`
- **scaffold.md:** `@vitest/coverage-v8` was missing from devDependencies for both Type 1 and Type 2 — added to both
- **agent-roles.md:** All three QA agent templates (Fullstack, SPA, Go) were missing `agentType: general-purpose` frontmatter — added to all three
- **SKILL.md:** "Never overwrite a file that already exists" rule conflicted with new scaffold approach — clarified that nuxi files must be replaced
- **SKILL.md:** Stale scaffold summary block listed removed files (`.npmrc`) and wrong path (`assets/css` vs `app/assets/css`) — replaced with reference to scaffold.md Announce block
- **SKILL.md:** Phase 5 skills table was missing `github-actions` for both Nuxt types — added to both
- **agent-roles.md:** Type 2 (SPA Frontend) architect role was marked "Recommended" instead of "Always" — changed to `✅ Always` for consistency
- **skill-manifest.md:** Install instructions missing registry qualifier — added `from affaan-m/everything-claude-code` to example
- **scaffold.md:** Added explicit note to substitute `{app-name}` placeholder in `db:migrate` script before writing
- **skill-manifest.md:** Base skill count comment said "12 base" but list actually has 13 — corrected to "13 base"

### Technical Notes

- **nuxi init flags:** Non-interactive mode (no TTY in Claude's bash) requires: `--template ui`, `--packageManager pnpm`, `--no-gitInit`, `--no-install`
- **CSS path:** `~/assets/css/main.css` in nuxt.config.ts is correct — `~` resolves to `app/` in Nuxt
- **Go Backend:** Unchanged by this refactor — still uses file-based scaffold with no package install
- **Coverage:** QA agents enforce 70% V8 coverage threshold — now functional with `@vitest/coverage-v8` installed
- **QA agents:** Now correctly generated with `agentType: general-purpose` so they can run scripts and write test files (Explore is read-only and would break the workflow)

---

## [1.5.0] - 2026-06-20

### Added

- **ESLint integration:** Added `@nuxt/eslint` to all Nuxt project types with stylistic config (commaDangle, braceStyle)
- **Zod skill:** Added `zod` to skill manifest for schema validation and type inference
- **PostToolUse hook:** Added `.claude/settings.json` with auto-ESLint on write for `.vue`, `.ts`, `.js`, `.mjs` files

### Fixed

- **Spec-scaffold drift:** Fixed inconsistencies between canonical stack specs and scaffold templates
- **Dependency references:** Fixed incorrect `@pinia/colada` references in documentation

---

## [1.4.0] - 2026-06-20

### Added

- **nuxt-auth-utils skill:** Added authentication skill for sessions, OAuth, password hashing, and WebAuthn
- **Skill manifest:** Updated `skill-manifest.md` to include `nuxt-auth-utils` as an optional skill for Fullstack MVP and SPA Frontend

### Changed

- **Agent roles:** Updated QA agents to reference auth testing patterns
- **Version:** Bumped to `1.4.0`

---

## [1.3.0] - 2026-06-20

### Added

- **CLAUDE.md:** Added comprehensive project documentation for Claude Code
- **Vitest skill:** Added unit testing skill with Vue Test Utils, happy-dom, and coverage support
- **Harness references:** Expanded `references/` with detailed specs for each project type

### Changed

- **Agent templates:** Updated QA agents to include Vitest testing patterns and coverage enforcement
- **Plugin structure:** Reorganized skills directory with reference files for progressive disclosure
- **Version:** Bumped to `1.3.0`

---

## [1.2.1] - 2026-06-20

### Fixed

- **plugin.json:** Added missing `author` metadata (name, email)
- **plugin.json:** Restored `skills` entry that was missing from plugin metadata
- **Skill description:** Improved `bigin-webapp-harness` skill description for better discoverability

---

## [1.2.0] - 2026-06-20

### Added

- **Initial release:** First public version of bigin-webapp-harness plugin
- **8-phase harness workflow:** Complete scaffold → agents → skills → orchestrator pipeline
- **Three project types:**
  - Type 1: Fullstack MVP (Nuxt v4 + Cloudflare Pages)
  - Type 2: SPA Frontend (Nuxt v4, SSR disabled)
  - Type 3: Backend (Go with chi router)
- **Agent role catalog:** Pre-configured templates for architect, frontend-dev, api-dev, database-dev, deployment, state-dev, backend-dev, qa
- **Skill generation:** Automatic generation of project-specific skills and orchestrator
- **Library skills:** Integrated find-skills for installing community skills
- **Scaffold templates:** File templates for each project type with proper Nuxt UI, Pinia, and Tailwind setup
- **Plugin metadata:** Marketplace-ready plugin.json with keywords and description

### Technical Notes

- **Stack conventions:** All Nuxt types use Google Sans font, primary blue, neutral slate theme, `ssr: false`
- **Agent model assignment:** `architect` uses Opus, all other agents use Sonnet
- **QA agent type:** Must use `general-purpose` (not Explore — read-only)
- **Skill discovery:** Uses `affaan-m/everything-claude-code` as preferred registry


