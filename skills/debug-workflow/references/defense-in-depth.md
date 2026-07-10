# Defense in Depth

Once root cause is confirmed and fixed, add validation at the layer that should have caught it originally — not just at the layer where the symptom surfaced.

Examples:
- Symptom surfaced as a crash in a Vue component because the API returned an unexpected shape → fix the API, but also tighten the Zod schema at the BFF boundary so the next shape mismatch is a 400, not a crash.
- Symptom surfaced as a bad DB write because a Go handler didn't validate a field → fix the handler, but also confirm the DB constraint (NOT NULL, CHECK) reflects the same rule.

This isn't "add validation everywhere" — it's specifically the layer nearest the untrusted/variable input enforcing the invariant, in addition to the fix at the layer where the bug actually lived. Skip this if the root cause was pure logic with no external input crossing a boundary (e.g. an off-by-one in a loop) — there's no boundary to harden.
