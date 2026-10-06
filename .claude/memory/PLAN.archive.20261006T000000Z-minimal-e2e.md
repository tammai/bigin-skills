# Plan: keep E2E minimal and light

Status: complete (v1.106.0, 2026-10-06)
Target release: v1.106.0 (minor; templated rule change + patch blocks)
Routing: worker (balanced → `worker`, sonnet/high). Score 2: an established pattern (the shared-addendum templates), 9 files, cause known. Verification bar: 5+ files, so run the gates across the whole tree, and prove every patch block applies to the v1.105.2 text.

## Spec

The rules today keep each E2E run light (seeding, login per worker, one spec while building), but nothing keeps the E2E suite small. Add one shared rule that does, and soften the "one spec per acceptance criterion" mandates that work against it.

**One shared block, written once.** It goes in `files-shared.md` as `## testing.md E2E addendum`, following the addendum pattern that file already uses. Every profile whose `testing.md` has, or plausibly gets, an E2E tier appends it: `nuxt`, `next`, `tauri`, `flutter` (`integration_test/`) and `qa`. Add it to `nuxt-marketing` only if that profile already has an E2E tier; otherwise state why in the report. The block is short, a handful of bullets, because rule files are read on every matching edit:

1. **E2E covers critical user journeys only.** One happy path per journey, plus the failure paths a real user hits (rejected login, payment declined). Validation, edge cases and error branches go to the lowest tier that can observe them: unit, component or API/integration.
2. **One spec per criterion that needs the running system.** A criterion a lower tier can observe gets a lower-tier test, not an E2E spec.
3. **Budget.** One spec takes ≤ ~30 s and the suite ≤ ~10 min. A spec or suite over budget is a harness finding, like a 429: split the journey, seed instead of clicking, or move assertions down a tier.
4. **When it runs.** E2E runs at staging deploy, or on a schedule against a deployed environment, never in pre-commit or the merge-gate CI. This matches the team's integration-test tier.
5. **Assert outcomes, not every step.** Check what the user ends up seeing, not each intermediate DOM state.

Keep each profile's stack-specific E2E text (nuxt's Playwright seeding and storageState bullets, tauri's WebdriverIO note) and drop any duplicate of the shared bullets from it.

**Soften the 1:1 mandates:**
- `profile-qa.md` testing.md: "One spec per acceptance criterion" becomes one spec per criterion that needs the running system. A criterion the owning repo can test below E2E is noted on the story for that repo, not written as an E2E case. Unit and integration tests already live in the api/web/mobile repos, as the template says.
- `profile-tauri.md`: "each acceptance criterion maps 1:1 to one E2E test" gets the same softening.
- `write-tests` (`SKILL.md` acceptance-criterion → E2E path and `references/acceptance-to-e2e.md`): for each cited criterion, pick the lowest tier that can observe it. Write E2E only for criteria that need the running system, and report the tier chosen for each criterion with a one-line reason.

**CI check:** if any profile's CI template (`ci.md`) runs E2E in the merge-gate workflow, record it in the report. Moving it to a deploy-staging step is in scope only if it's a small, contained change; otherwise list it as a follow-up.

## Tasks

| # | Task | Notes |
|---|---|---|
| 1 | `files-shared.md` `## testing.md E2E addendum`, plus the append instruction in `rule-files.md`/SKILL.md where testing.md is written | single source |
| 2 | Per-profile testing.md: append the addendum and de-duplicate (nuxt, next, tauri, flutter, qa; nuxt-marketing only if it has an E2E tier) | keep stack-specific bullets |
| 3 | Soften 1:1 in qa, tauri, write-tests | |
| 4 | Patch blocks: one per profile `testing.md` target, `optional: true`, idempotent (content never contains its anchor), proven against the v1.105.2 templates | |
| 5 | Docs: any doc describing E2E/test tiers (USER_GUIDE, GATES, handbook) | mermaid only if a flow is described |
| 6 | Gates + v1.106.0 release prep (version ×4, CHANGELOG with blocks), no commit | owner confirms |

## Amendments
- 2026-10-06 (owner confirmed): Flutter's 1:1 E2E mandate softened like qa/tauri; nuxt-marketing gets no addendum (no E2E tier); write-tests `description:` and manifest summary updated to the tier-per-criterion behaviour; next's testing.md `paths:` gains `e2e/**` and `playwright.config.ts` (manual step for existing repos). Verifier: FAIL round 1 (one contradictory CHANGELOG sentence, removed by the orchestrator), PASS round 2.
