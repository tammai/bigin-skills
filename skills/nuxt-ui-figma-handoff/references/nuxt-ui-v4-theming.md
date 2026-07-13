# Nuxt UI v4 theming reference

Source of truth: https://ui.nuxt.com/docs/getting-started/theme (Design System, CSS
Variables, Components pages). Verify against the live docs if a project is on a version
other than the one that page shows in its header, since this file is a snapshot.

## Layer 1 — raw tokens in `main.css` (`@theme`)

Tailwind v4 is CSS-first: design tokens are declared with `@theme` in the CSS entry
point.

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";

@theme {
  --font-sans: 'Public Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --breakpoint-3xl: 1920px;
}

@theme static {
  /* Overriding a default Tailwind color */
  --color-green-500: #00C16A;
  /* ... all shades 50-950 must be defined together for a color to work */

  /* A brand-new custom color */
  --color-brand-50: #fef2f2;
  --color-brand-100: #fee2e2;
  --color-brand-200: #fecaca;
  --color-brand-300: #fca5a5;
  --color-brand-400: #f87171;
  --color-brand-500: #ef4444;
  --color-brand-600: #dc2626;
  --color-brand-700: #b91c1c;
  --color-brand-800: #991b1b;
  --color-brand-900: #7f1d1d;
  --color-brand-950: #450a0a;
}
```

Rule of thumb: if the designer's Figma "local variable" is a raw hex tied to a shade
number (`brand/500`, `green/700`, etc.), it belongs here. If it only exists as a named
role (`primary`, `neutral`) with no shade number, it belongs in Layer 2 instead.

### Other global CSS variables (also `main.css`, but at `:root` / `.dark`, not `@theme`)

| Variable | Default | Controls |
|---|---|---|
| `--ui-radius` | `0.25rem` | Base for every `rounded-*` utility across all components |
| `--ui-container` | `80rem` | Max width of the `Container` component |
| `--ui-header-height` | `4rem` | Height of the `Header` component |
| `--ui-primary`, `--ui-secondary`, etc. | `var(--ui-color-<role>-500)` | Which shade of the role is used by default; override per light/dark in `:root` / `.dark` if the designer wants a different shade in each mode |
| `--ui-text`, `--ui-text-muted`, `--ui-text-dimmed`, `--ui-text-toned`, `--ui-text-highlighted`, `--ui-text-inverted` | various neutral shades | Text color utilities (`text-muted`, `text-dimmed`, ...) |
| `--ui-bg`, `--ui-bg-muted`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-bg-inverted` | various | Background color utilities |
| `--ui-border`, `--ui-border-muted`, `--ui-border-accented`, `--ui-border-inverted` | various | Border color utilities |

Example — bumping the base radius and adjusting the default primary text shade in dark
mode:

```css
:root {
  --ui-radius: 0.5rem;
}
.dark {
  --ui-primary: var(--ui-color-primary-400);
}
```

## Layer 2 — semantic color mapping in `app.config.ts`

Nuxt UI ships seven semantic roles: `primary`, `secondary`, `success`, `info`,
`warning`, `error`, `neutral`. Each is just a name pointing at one of your Tailwind
colors (default palette or one you defined in `@theme`).

```ts
// app/app.config.ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      secondary: 'purple',
      neutral: 'zinc'
    }
  }
})
```

You can only reference a color that exists in the theme — either a Tailwind default
(`blue`, `green`, `zinc`, ...) or one defined via `@theme` in Layer 1. If the designer
wants an eighth role beyond the default seven (e.g. `tertiary`), it must first be
registered in `nuxt.config.ts` under `ui.theme.colors` (an array of role names) before
it can be assigned a color in `app.config.ts`.

## Layer 3 — per-component overrides in `app.config.ts`

Every component's visual structure is expressed with the Tailwind Variants API:

- `slots` — one entry per distinct part of the component (e.g. Card has `root`,
  `header`, `body`, `footer`). Single-element components only have a `base` slot.
- `variants` — classes applied to slots based on a prop (e.g. `size`).
- `compoundVariants` — classes applied only when multiple variant conditions match at
  once (e.g. `color: 'neutral'` AND `variant: 'outline'` together).
- `defaultVariants` — the prop values used when the component is rendered with no
  explicit prop.

Global overrides in `app.config.ts` use the **exact same shape** as the component's
source theme, and are merged onto the defaults (via `tailwind-merge`), not replacing
them — so you only need to write the classes that changed:

```ts
export default defineAppConfig({
  ui: {
    button: {
      slots: {
        base: 'font-bold' // overrides the default `font-medium`
      },
      variants: {
        size: {
          md: { leadingIcon: 'size-4' } // overrides `size-5` for the md leading icon
        }
      },
      compoundVariants: [{
        color: 'neutral',
        variant: 'outline',
        class: 'ring-default hover:bg-accented'
      }],
      defaultVariants: {
        color: 'neutral',
        variant: 'outline'
      }
    }
  }
})
```

To replace a slot's classes entirely instead of merging onto the default, set it to a
function that returns the class string (it receives the resolved default as its
argument if you want to reuse part of it):

```ts
button: {
  slots: {
    label: () => 'text-base font-bold'
  }
}
```

Find each component's current default theme (needed to know what you're diffing
against) at `github.com/nuxt/ui/tree/v4/src/theme/<component>.ts`, or locally in
`node_modules/@nuxt/ui` if installed. The per-component docs page on ui.nuxt.com also has
a "Theme" section for exactly this.

## Extracting the actual values from Figma

Nuxt's own FAQ for the Figma kit recommends **TemPad Dev**: a Chrome extension plus an
official Nuxt UI plugin. With a Nuxt UI Figma component selected in dev mode, it outputs
the real Tailwind classes and prop values for that instance — far more reliable than
reading pixel values off the canvas, especially for spacing, ring colors, and font
weight. Point a developer toward this whenever the Figma MCP connector isn't available.

## Version caveat

This file describes Nuxt UI **v4** (built on Tailwind CSS v4's CSS-first `@theme`
config). Nuxt UI v2 used plain string keys (`ui.primary`, `ui.gray`) with no CSS
variable layer, and v3 introduced CSS variables but with a different color-scale
mechanism than v4's. Always check the installed `@nuxt/ui` version in `package.json`
before applying anything above — if it doesn't match v4, treat this file as directional
only and check `https://ui{2,3}.nuxt.com` docs for the right shape.
