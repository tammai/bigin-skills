---
name: eli5
description: "Explicit only — type /eli5 <topic>. Explains a topic as a picture with few words: an HTML artifact by default, or a standalone SVG/PNG when you ask for a diagram to embed. Use for flowcharts, decision trees, and how-does-this-work explainers."
argument-hint: [topic]
disable-model-invocation: true
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/check_diagram.mjs *)
effort: medium
---

# eli5

Explain like the reader knows nothing about this topic — big picture, few words.

Adapted from the MIT-licensed `eli5` plugin v1.0.0 by Thariq Shihipar, installed from the
claude-community marketplace; no repository URL is published with it, so none is linked here.
What this version adds: an embeddable SVG/PNG output, and the diagram rules below — each of
which is here because it shipped as a visible defect first.

Topic: $ARGUMENTS

## Pick the output first

| They want | Give them |
| --- | --- |
| To understand something (default) | **HTML artifact** — big visuals, few words, one idea per screen |
| A diagram for a doc, handbook, or README | **Standalone SVG** |
| A diagram for a slide, an issue, or chat | **PNG**, converted from that SVG |

Default to the artifact. Choose SVG or PNG only when they say where it's going — "for the
handbook", "to paste in Slack", "embed this". If the target is a page you can read, match its
existing diagrams: same CSS custom properties, same arrow marker, same type scale. A diagram
that doesn't match its neighbours reads as imported.

**PNG needs a converter.** Probe in order and use the first that exists:
`rsvg-convert -w 1600 in.svg -o out.png` · `magick -density 200 in.svg out.png` ·
`inkscape in.svg -o out.png -w 1600` · `resvg in.svg out.png` · on macOS,
`qlmanage -t -s 1600 -o . in.svg` (writes `in.svg.png`). If none is installed, deliver the SVG,
say which converters would work, and don't pretend a PNG was produced.

## Diagram rules

**SVG `<text>` does not wrap.** Nearly everything below follows from that one fact.

1. **One line per `<text>`.** A label too long for its box runs past both rounded corners. Split
   it across two `<text>` elements and grow the box height.
2. **Never widen one box to fit its label.** A column of steps reads as a column only if the
   boxes line up; widening one trades a text bug for an alignment bug. Wrap the label, or reword
   it — the shorter wording is often the more precise one.
3. **Budget the label before you write it.** Roughly `chars × font-size × 0.5` px, against
   `box width − 16`. At `font-size: 13` in a 300px box that's ~43 characters; at `10.5`, ~54.
4. **Compute every edge endpoint from the shape it touches.** An edge meeting a box side belongs
   at `y + height/2`, not at a number that looked right — that number stops being the centre the
   moment a height changes, and nothing tells you.
5. **A third outcome usually needs a second decision node.** If the third branch turns on a
   *different question*, a third arrow off one diamond states something false. Two nodes in
   sequence, each with its own question, is the honest shape.
6. **Theme tokens, not hex.** In a page that has them, use its custom properties so the diagram
   follows light/dark. Standalone, define them once on the root and use `prefers-color-scheme`.
7. **The `aria-label` is the diagram in prose.** Every exit, including ones added later. It is
   the only version a screen reader gets, and the first thing to go stale.

## Check it before you hand it over

```bash
node ${CLAUDE_SKILL_DIR}/scripts/check_diagram.mjs path/to/file.svg      # or the .html it lives in
```

Reports label overflow, mixed widths in a centred column, overlapping boxes, anything outside the
viewBox, and edges that miss a face's centre. Exit 1 on any finding. It skips `<svg>` markup that
is really a JavaScript string, and it **estimates** label widths — a near-miss is worth looking at
rather than trusting in either direction.

Run it on what you produced, and on the file you embedded into. Both of the defects that motivated
this skill passed a visual read and failed this check.

## When not to use

- **A data chart** — bars, lines, pie, a plotted dataset. That's a charting job, not an explainer.
- **A screenshot would be truer.** Don't draw a UI that already exists; capture it.
- **The answer is one sentence.** A picture of one sentence is a slower sentence.
