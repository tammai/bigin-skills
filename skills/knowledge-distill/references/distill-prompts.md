# Distillation & audit prompts

Two canonical prompts. `## Distillation` is guidance you follow yourself in Phase 1;
`## Audit` is passed verbatim to the `knowledge-auditor` agent in Phase 2.

---

## Distillation

You are writing for an agent that has never seen this library's current version and will act
on what you write without checking. Optimize for **decisions**, not coverage.

**The index file** (`libraries/<lib>/index.md`) answers, in this order:

1. **Mental model** — the 3–5 sentences that make the rest of the library predictable. What
   are the core objects, what owns lifecycle, what runs where (server/client/build).
2. **Decision tables** — the choices a developer actually faces, as a table. "Fetching data:
   `useFetch` when X, `$fetch` when Y, `useAsyncData` when Z." A table beats three paragraphs.
3. **Top anti-patterns** — the mistakes this library specifically invites, with the correct
   shape next to each. Ranked by how often they'd be made, not by severity.
4. **Deltas from the previous major** — what an agent trained on the old version will get
   wrong. This is the highest-value section in the whole bundle; it's the reason the bundle
   exists. Removed APIs, renamed options, changed defaults, changed directory conventions.
5. **Links to every topic file**, one line each, saying when to open it.

Never a table of contents. If a line says nothing a filename doesn't already say, cut it.

**A topic file** (`libraries/<lib>/<topic>.md`) covers one area:

- The API surface an agent needs: names, signatures, the options that matter and their
  defaults. Not every option — the ones that change behavior in practice.
- Idioms: the shape working code takes. Short, real, runnable-looking.
- Anti-patterns for this topic, with corrections.
- What's version-specific here, called out explicitly.

**`sources.md`** maps each topic to where it lives in the source repo, so a deep dive knows
which files to open. Paths, not prose.

**Discipline that applies everywhere:**

- **Rewrite, never copy.** Paraphrase into our decision-oriented framing. Short illustrative
  code shapes are fine; pasted doc prose or a reproduced doc page is not.
- **Prefer source over docs when they disagree**, and say so in the file. Docs lag.
- **When docs are thin, read the source** — signatures and defaults are in the implementation,
  and a guessed default is the single most damaging thing you can write here.
- **Never invent.** If you can't confirm something at this commit, leave it out. An incomplete
  bundle is fine; a confident wrong line is what the audit phase exists to catch.
- **`Team convention:` prefix** on every blended house rule, at the point of relevance.
- **Budget**: `count_budget.mjs` has to pass. Cut low-value lines; don't shard into files
  nothing links to.

---

## Audit

Pass this to `bigin-skills:knowledge-auditor` together with the bundle path, the clone path,
the tag, and the SHA. Pass no summary of the distillation work itself.

> Audit the distilled library knowledge bundle at `<bundle_path>` against the library's own
> source at `<clone_path>`, which is checked out at tag `<tag>` (commit `<sha>`).
>
> Every substantive claim in the bundle must be checkable against that clone. For each file:
> read it, then verify its claims against the source and docs — API names, signatures, option
> names, defaults, and behavior. Grep the clone; do not rely on your own knowledge of this
> library, which may be from a different version. Where the bundle's claim and the source
> disagree, the source at this commit wins, always.
>
> Check specifically:
> - APIs that don't exist at this commit, or exist with a different signature.
> - Option names and default values that contradict the implementation.
> - Claims about the previous major version that cannot be verified at this commit and are not
>   marked as historical.
> - Lines prefixed `Team convention:` that actually describe library behavior, and library
>   behavior stated as fact that is really a house rule and is missing the prefix.
> - Frontmatter `version` / `source_commit` disagreeing with the clone's actual tag and SHA.
> - A missing `# Citations` section, or one citing paths that don't exist in the clone.
>
> Do not report style, wording, topic selection, or level of detail. An accurate bundle that
> reads awkwardly passes.
>
> Return only the JSON object from `skills/knowledge-distill/references/audit-contract.md`.
