#!/usr/bin/env node
// Generate a Tailwind-style 50-950 hex shade ramp from a single brand color.
//
// Nuxt UI (and Tailwind v4's @theme system) needs a full 50-950 palette to register a
// usable color -- but a Figma handoff often only gives you one swatch (e.g. "the brand
// color is #7C3AED"). This script fills in the rest of the ramp algorithmically so there's
// something to drop into main.css immediately.
//
// This is a reasonable approximation, not a substitute for the designer's judgment --
// always say so when handing the result to a developer, and suggest a design sign-off
// before it ships.
//
// Usage:
//   node generate_color_scale.mjs "#7C3AED" --name brand
//   node generate_color_scale.mjs "#7C3AED" --name brand --anchor 500
//
// Output: a --color-<name>-50 ... --color-<name>-950 block ready to paste into an
// `@theme` (or `@theme static`) block in main.css.

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Approximate lightness curve for a "typical" Tailwind color, in HSL terms (0-1).
const LIGHTNESS_CURVE = {
  50: 0.98, 100: 0.95, 200: 0.90, 300: 0.82, 400: 0.70, 500: 0.60,
  600: 0.50, 700: 0.42, 800: 0.32, 900: 0.24, 950: 0.15,
};

// Saturation is pulled down slightly at the very light end so 50/100 don't look neon.
const SATURATION_MULT = {
  50: 0.40, 100: 0.50, 200: 0.65, 300: 0.80, 400: 0.90, 500: 1.00,
  600: 1.00, 700: 0.95, 800: 0.90, 900: 0.85, 950: 0.80,
};

function hexToRgb(hexColor) {
  let hex = hexColor.trim().replace(/^#/, "");
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  if (hex.length !== 6) throw new Error(`Not a valid hex color: ${JSON.stringify(hexColor)}`);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  if ([r, g, b].some(Number.isNaN)) throw new Error(`Not a valid hex color: ${JSON.stringify(hexColor)}`);
  return [r, g, b];
}

function rgbToHex([r, g, b]) {
  const clamp = (c) => Math.max(0, Math.min(1, c));
  const toHex = (c) => Math.round(clamp(c) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHls(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4; break;
  }
  h /= 6;
  return [h, l, s];
}

function hlsToRgb(h, l, s) {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function generateScale(baseHex, anchor) {
  if (!(anchor in LIGHTNESS_CURVE)) {
    throw new Error(`Anchor shade must be one of ${SHADES.join(", ")}, got ${anchor}`);
  }

  const [r, g, b] = hexToRgb(baseHex);
  const [h, l, s] = rgbToHls(r, g, b);

  // Shift the whole curve so the anchor shade reproduces the input color exactly.
  const delta = l - LIGHTNESS_CURVE[anchor];

  const scale = {};
  for (const shade of SHADES) {
    const targetL = Math.min(0.98, Math.max(0.03, LIGHTNESS_CURVE[shade] + delta));
    const targetS = Math.min(1.0, s * SATURATION_MULT[shade]);
    scale[shade] = rgbToHex(hlsToRgb(h, targetL, targetS));
  }

  // Keep the anchor shade exactly as given, rounding aside.
  scale[anchor] = rgbToHex([r, g, b]);
  return scale;
}

function parseArgs(argv) {
  const args = { name: "brand", anchor: 500 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--name") {
      args.name = argv[++i];
    } else if (arg === "--anchor") {
      args.anchor = Number(argv[++i]);
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      positional.push(arg);
    }
  }
  args.hexColor = positional[0];
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.hexColor) {
    console.log('Usage: node generate_color_scale.mjs "#7C3AED" --name brand [--anchor 500]');
    process.exit(args.help ? 0 : 1);
  }

  if (!SHADES.includes(args.anchor)) {
    console.error(`Error: --anchor must be one of ${SHADES.join(", ")}, got ${args.anchor}`);
    process.exit(1);
  }

  let scale;
  try {
    scale = generateScale(args.hexColor, args.anchor);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }

  console.log(`/* Generated from ${args.hexColor} (treated as shade ${args.anchor}). */`);
  console.log(`/* This is an algorithmic approximation -- confirm with the designer before shipping. */`);
  for (const shade of SHADES) {
    console.log(`--color-${args.name}-${shade}: ${scale[shade]};`);
  }
}

main();
