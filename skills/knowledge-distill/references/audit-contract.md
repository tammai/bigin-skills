# Audit contract

Single source of truth for the auditor's output schema in `knowledge-distill`'s verify phase.
Referenced by `agents/knowledge-auditor.md`'s system prompt and by `SKILL.md`'s Phase 2, which
parses the result — don't duplicate this schema elsewhere; point at this file instead.

```json
{"verdict": "PASS" | "FAIL", "issues": ["...", "..."]}
```

- `verdict` — exactly `"PASS"` or `"FAIL"`, nothing else.
- `issues` — empty array on `PASS`. On `FAIL`, one entry per problem found, each a
  self-contained one-sentence description naming the file, the claim, and what the source
  actually says. The next round's fixer sees only these strings, never the auditor's reasoning,
  and the auditor of that round has no memory of this one.

The auditor's entire response must be this JSON object — no markdown code fence, no preamble,
no summary line before or after. Main parses the response directly as JSON.

`FAIL` on any of: an API that doesn't exist at the pinned commit; a signature, option name, or
default that contradicts source; a claim about the previous major version that can't be checked
at this commit and isn't marked as such; a `Team convention:` rule presented as library
behavior, or a house rule blended in without that prefix; frontmatter whose `version` or
`source_commit` disagrees with the clone; a missing or wrong `# Citations` section.

Style, wording, topic selection, and how much detail a file carries are **not** audit findings.
An accurate bundle that reads awkwardly passes.
