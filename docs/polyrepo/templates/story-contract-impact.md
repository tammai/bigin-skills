<!-- BMAD story template addition (umbrella R4). Appended to the story template in .bmad-core.
     Filled by BA/architect at write time.

     Enforced by story_lint.mjs, which validates this section's presence and values and
     ignores everything else in the story. That lint is built on stated assumptions about
     BMAD's story format (see PLAN.md Phase 5) — all of them isolated in one parsing
     function, for rework against the first live specs repo. -->

## Contract impact

- contracts: none | <service>.v<major> — endpoints touched
- breaking: yes | no
- ui: yes | no   <!-- yes ⇒ ready-for-dev gate requires a story-meta sidecar with a Figma node-id and status: final -->
