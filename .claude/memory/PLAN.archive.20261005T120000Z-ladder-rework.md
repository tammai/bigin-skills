# Plan: rework the model ladder (2 tiers + verifier)

Status: complete (v1.105.0, 2026-10-05)
Target release: v1.105.0 (minor)

## Spec

Replace quick/standard/deep + verifier, and the three profiles, with two implementer tiers plus the verifier and two profiles. The goals are lower cost, a ladder fitted to the 5.5 models, and fewer moving parts.

| Tier | `balanced` (default) | `frontier` |
|---|---|---|
| worker | `worker` — sonnet / high | `worker-frontier` — opus / medium |
| architect | `architect` — opus / medium | `architect-frontier` — opus / high |
| verifier | `verifier` — sonnet / high | `verifier` — sonnet / high |

- **Routing agents (5, was 6; `knowledge-auditor` is untouched):** `worker`, `worker-frontier`, `architect`, `architect-frontier`, `verifier`. `quick-executor`, `standard-worker`, `standard-worker-high`, `deep-architect`, `verifier-medium` are removed. `*-frontier` bodies are byte-identical to their base; frontmatter differs in `name`, `model`, `effort` (and description). The docs_sync variant drift check is retargeted.
- **Scoring:** capability 0–4 → worker, 5+ → architect; existing auto-overrides to deep now go to architect. The verification-bar triggers (high-risk path, coverage < 0.3, new code file, 5+ files, flaky) set the bar only. There is no quick tier left to promote out of.
- **Config (`.claude/model-routing.json`):** valid profiles are only `balanced` and `frontier`, and valid tier keys only `worker`, `architect` and `verifier`. There are no legacy aliases (owner, 2026-10-05: they will update repos' configs and apply the patch themselves). Any other value is unknown and degrades to the default with a warning. Models stay `fable`, `opus`, `sonnet` and `haiku`; Fable remains reachable only as an override. The CHANGELOG carries a rename table as the migration note.
- **Docs:** `model-profiles.md` is rewritten around the 5.5 lineup and pricing ($/1M in/out: Fable 5.1 10/50, Opus 5.5 4/20 with default effort `medium`, Sonnet 5.5 2/10, Haiku 4.5 1/5 with no effort). Drop the stale "high is every model's default" claim.
- **Out of scope:** `product-rebuild-skills`' own copy of the routing tables (separate repo).

## Tasks

| # | Task | Notes |
|---|---|---|
| 1 | `classify.mjs`: PROFILES/EFFORTS/AGENTS/TIERS, legacy aliases + warnings, output shape | regress cases for aliases |
| 2 | Agents: create 5, delete 5, merge quick-executor's useful guidance into `worker` | descriptions short; budget gate |
| 3 | model-router SKILL.md + references (rubric thresholds, profiles, agent-invocation) | |
| 4 | task-workflow / epic-workflow / discovery-workflow / debug-workflow / any skill naming old tiers or agents | grep every old name |
| 5 | bigin-harness-setup: Phase 1.5 MODEL_ROUTING options, model-routing.json template, any templated text naming tiers | patch blocks if templated |
| 6 | tools: docs_sync variant check + docs-manifest, regress, context_budget | |
| 7 | Docs: README (generated tables), docs/ROUTING.md, USER_GUIDE, site/src | mermaid where a flow is described |
| 8 | Release v1.105.0: version ×4, CHANGELOG (+ patch blocks, migration note), gates | owner confirms before commit |

## Amendments
- 2026-10-05 (owner): new auto-override. A **root cause unknown** sends the task to the architect without scoring, however small the scope. Applied in model-router SKILL.md (Step 3 list and the exhaustion line), scoring-rubric.md (override table and example 2), docs/ROUTING.md (list and mermaid), and the architect agents' intro (bodies still identical).
