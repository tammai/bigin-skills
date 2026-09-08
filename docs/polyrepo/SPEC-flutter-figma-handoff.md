# Spec: `flutter-figma-handoff` skill

- **Status:** Approved (decisions recorded §8; corrections C1, C9 applied 2026-09-08)
- **Target release:** bigin-skills vNext
- **Owner:** Tam Mai
- **Depends on:** the flutter profile (repo type `mobile`); a BigIn fork of the Material 3 Design Kit existing as a Figma team library
- **Implementation plan:** [../../PLAN.md](../../PLAN.md) Phase 7
- **Renamed from** `SPEC-figma-handoff-flutter.md` — this is a new sibling skill, not an extension (§2).

---

## 1. Problem Statement

Web design and dev share a base through Nuxt UI. Mobile has none: designers draw free-form, devs rebuild by eye, and no component mapping exists, so agents invent widgets instead of reusing them. The design team needs one template file that plays the role Nuxt UI's template plays for web.

**What the existing skill actually does (C1).** The draft described `figma-handoff` as mapping Figma to code "through the Nuxt UI Figma template" with "token extraction + Nuxt UI component mapping". The shipped skill is `nuxt-ui-figma-handoff`, and it classifies *changed tokens* into two destinations — `main.css` (`@theme` ramps, `--ui-radius`, fonts, container sizes) and `app.config.ts` (`ui.colors.<role>`, per-component slots and variants) — per `SKILL.md:72-92`. There is no Figma-component → code-component mapping table, and no target concept to extend. Its one script emits a Tailwind 50–950 ramp, which a `ColorScheme` has no use for.

## 2. A new skill, not a target

The draft called itself "an extension, not a new skill". Against the actual file that is the more expensive option, so it is reversed:

- `nuxt-ui-figma-handoff`'s `name`, `description`, `argument-hint` and `## When not to use` all scope it to Nuxt UI theming. A target switch means renaming it and making one always-loaded `description` trigger on two stacks inside 350 chars.
- Its acceptance criterion "Nuxt UI handoff behaviour is unchanged" becomes true **by construction** if the file is not touched, and something to prove if it is.
- Nothing meaningful is shared. The ~10-line "ask for a real Figma URL, prefer MCP" preamble is duplicated deliberately: TemPad Dev, the documented fallback, is a Nuxt UI plugin with no Flutter equivalent, so the fallback advice legitimately differs.

Cost accepted: C9's packaging debt applies twice across this release (evals, manifest entry, ≤350-char description, README regeneration, version fields, CHANGELOG).

## 3. Approach

Flutter's widget set is the Material 3 implementation — M3 has been the framework default since Flutter 3.16, with components generated from the M3 token database. The shared base therefore already exists: Google's official **Material 3 Design Kit** on Figma Community. This spec forks it rather than authoring a template.

## 4. Goals

1. Design and mobile dev share one Figma base: a BigIn fork of the M3 Design Kit, branded per client through Figma Variables.
2. A `flutter-figma-handoff` skill, pointed at by the `mobile` profile: tokens emit `ThemeData`/`ColorScheme`, components resolve to Flutter widgets.
3. The fork only contains components Flutter ships. Google's kit runs ahead of the framework; unpruned, designers hand over frames no widget can build.

## 5. Deliverables

| Item | Form | Owner after release |
|---|---|---|
| M3 Design Kit fork, pruned to shipped widgets, BigIn variable structure | Figma file (team library), link + pruning list in `assets/` | design team |
| `references/flutter-mapping.md` | table: M3 component → Flutter widget + key props (Common buttons → `FilledButton` / `FilledButton.tonal` / `OutlinedButton` / `TextButton`; Text fields → `TextField` + `InputDecoration`; Navigation bar → `NavigationBar`; …) | dev |
| token adapter | Figma Variables → `ColorScheme` / `TextTheme` / `ThemeData` emitted into the flutter repo's theme location, in deterministic order | dev |
| `SKILL.md` + `evals/evals.json` | new skill; the `mobile` profile points at it | dev |

## 6. Theming

**`ColorScheme.fromSeed` plus explicit overrides** (decided §8.1). The fork owes one seed variable and a named override set — only the roles it genuinely diverges on; Flutter derives the rest. This is the smaller standing obligation on the design team and it survives Material updates.

Consequence to state in the skill: a seed change legitimately moves roles nobody edited, so the emitted diff is wider than the designer's edit. That is correct behaviour, not a bug — which is why the adapter emits in a deterministic order, so the diff stays reviewable.

## 7. Non-Goals

- **Cupertino styling.** BigIn mobile apps are simple API clients on Material defaults; iOS-flavored design is a per-client decision, not standard.
- **Code Connect for Flutter.** No equivalent mechanism; the mapping reference file carries that role.
- **A custom component library.** The point is adopting the framework's own design system, not building one.
- **Touching `nuxt-ui-figma-handoff`.** Per §2.

## 8. Workflow after adoption

Designer builds frames from the forked kit → dev reads the story sidecar's node-id → `flutter-figma-handoff` resolves components via the mapping table and themes via the token adapter → agent composes existing widgets instead of free-drawing.

## 9. Acceptance criteria

- [ ] A frame built from the forked kit hands off to a Flutter screen using only mapped widgets — no custom-painted lookalikes
- [ ] Changing the seed or a brand-color variable in the fork and re-running handoff changes only theme files in the mobile repo diff, emitted in a stable order
- [ ] A frame using a pruned (unshipped) component fails handoff with a message naming the component and the pruning list
- [ ] `nuxt-ui-figma-handoff` is byte-identical to its pre-release state

## 10. Decisions and open questions

**Decided 2026-09-08:**

1. **Theming approach** — `ColorScheme.fromSeed` + explicit overrides, per §6.
2. **Skill placement** — new sibling skill, per §2.

**Open:**

1. **Kit pruning list** (non-blocking): confirm against the Flutter version the repo pins; recheck on framework bumps. — dev
2. **Typography source** (non-blocking): kit text styles as-is vs mapping onto an existing `TextTheme` naming. — design team
