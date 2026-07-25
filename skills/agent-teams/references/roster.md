# Our agents as teammates

A subagent definition from any scope — including this plugin's `agents/*.md` — can be spawned as a teammate by naming its type. Reuse them rather than writing ad-hoc prompts.

## What changes on the teammate path

| Frontmatter | As a subagent | As a teammate |
| ----------- | ------------- | ------------- |
| `tools:` | Applied | Applied — **but** `SendMessage` and the task tools are added back regardless of the allowlist |
| `model:` | Applied | Applied. Resolution: `CLAUDE_CODE_SUBAGENT_MODEL` → the spawn call's `model` → frontmatter → `teammateDefaultModel` → the lead's model |
| `effort:` | Applied, overrides session effort | **Ignored** — teammates inherit the lead's effort level |
| `skills:` | Preloaded into context | **Ignored** — the teammate must invoke skills via the `Skill` tool |
| `mcpServers:` | Applied | **Ignored** — loaded from project/user settings like a normal session |
| body | Is the system prompt | **Appended** to the teammate's own system prompt as extra instructions |
| `isolation: worktree` | Real per-agent worktree | **Not available** — the teammate spawn path passes the lead's `cwd` |

Two consequences worth stating at spawn time: a deep-tier teammate is **not** running at `xhigh` unless the lead is, and no teammate can ask the human anything (`AskUserQuestion` is unavailable to spawned agents), so every decision routes to the lead.

## Fit per agent

| Agent | As a teammate | Notes |
| ----- | ------------- | ----- |
| `bigin-skills:standard-worker` | **Good default implementer.** | Its `skills:` (`debug-workflow`, `write-tests`) are dropped — its body now tells it to invoke them explicitly. Spawn with `plan_mode_required`. |
| `bigin-skills:deep-architect` | Use for a slice that carries an architectural decision. | Raise the lead's `/effort` first, or it runs at whatever the lead is at. Prefer a single deep teammate over several. |
| `bigin-skills:quick-executor` | Rarely worth a teammate. | Its scope (≤2 files, mechanical) is smaller than the coordination overhead of a team seat. Keep it as a subagent. |
| `bigin-skills:verifier` | **Good — one per implementing teammate.** | Read-only for files; gains messaging/task tools in team mode. Spawn fresh per verification round and hand it a diff scoped to the plan's `Owns:` globs. |

## Review and research teams

The docs' recommended starting point, and it needs no ownership at all — nobody writes:

- Give each teammate a **distinct lens** rather than the same brief (security / performance / test coverage), or a distinct **hypothesis** for a debugging debate, and tell them to challenge each other's findings. The adversarial structure is the mechanism: sequential investigation anchors on the first plausible explanation.
- Mark these tasks `[coordination]` so the task gates don't demand a plan.
- Consider `tools: Read, Grep, Glob, Bash` on a purpose-made definition rather than trusting prose to keep a reviewer read-only.
- The lead synthesizes and dedupes; don't relay each teammate's report verbatim.

## Naming

The lead assigns every teammate a name, and that name is the only handle for messaging, task ownership, and shutdown. Choose them at spawn time and keep them meaningful (`alpha`/`beta` are fine for two; `api`/`table`/`reviewer` are better for more) — you'll be referring to them in later prompts, and a name that describes the slice makes a stale `owner:` field obvious.
