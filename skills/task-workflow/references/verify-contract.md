# Verify contract

Single source of truth for the verifier's output schema in `task-workflow`'s implement/verify loop. Referenced by `agents/verifier.md`'s system prompt and by `SKILL.md`'s orchestration step that parses the result — don't duplicate this schema elsewhere; point at this file instead.

```json
{"verdict": "PASS" | "FAIL", "issues": ["...", "..."]}
```

- `verdict` — exactly `"PASS"` or `"FAIL"`, nothing else.
- `issues` — empty array on `PASS`. On `FAIL`, one entry per problem found, each a self-contained one-sentence description (file/behavior/expectation), since the resumed implementer sees only this string, never the verifier's own reasoning.

The verifier's entire response must be this JSON object — no markdown code fence, no preamble, no summary line before or after. Main parses the response directly as JSON.
