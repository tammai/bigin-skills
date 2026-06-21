# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [1.5.0] - Previous

- ESLint integration
- Zod skill added
- Spec-scaffold drift fixes
