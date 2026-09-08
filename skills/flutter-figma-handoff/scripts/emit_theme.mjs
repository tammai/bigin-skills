#!/usr/bin/env node
/**
 * emit_theme.mjs — Figma Variables to a Flutter ThemeData, deterministically.
 *
 * Usage:
 *   node emit_theme.mjs --seed '#6750A4' [--overrides tokens.json]
 *                       [--font 'Inter'] [--out lib/core/design/app_theme.dart]
 *
 * tokens.json, when given, is { "light": { "<role>": "#rrggbb", ... }, "dark": {...} },
 * with role names exactly as Flutter's ColorScheme spells them.
 *
 * Node >=20 stdlib only. Exit 0 ok, 1 runtime failure, 2 bad usage.
 *
 * TWO PROPERTIES THIS FILE EXISTS TO GUARANTEE
 *
 * 1. `ColorScheme.fromSeed` plus explicit overrides, not a full hand-written
 *    scheme. The design side then owes one seed and only the roles it genuinely
 *    diverges on, instead of ~30 roles per brand doubled for light and dark and
 *    maintained forever. The cost is real and stated: changing the seed moves
 *    roles nobody edited. That is correct behaviour, not a bug.
 *
 * 2. Because of (1), the emitted file must be DETERMINISTIC — roles in a fixed
 *    canonical order, never JSON key order — or every re-run produces a diff
 *    that is mostly noise and the review that is supposed to catch a real change
 *    stops happening.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'

// Flutter's ColorScheme roles, in the order Material documents them. This order is
// the file's output order and must not be sorted, shuffled, or "tidied".
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'onSurfaceVariant',
  'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant',
  'inverseSurface', 'onInverseSurface', 'inversePrimary',
  'shadow', 'scrim', 'surfaceTint'
]

// Removed from ColorScheme in Flutter 3.22's Material 3 alignment. A designer's
// variable set may still carry them; emitting them produces code that will not
// compile, so name the replacement rather than dropping them silently.
const RETIRED = {
  background: 'surface',
  onBackground: 'onSurface',
  surfaceVariant: 'surfaceContainerHighest'
}

function fail(msg, code = 1) {
  console.error(`[emit-theme] ERROR: ${msg}`)
  process.exit(code)
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i

// Dart wants 0xAARRGGBB. A 6-digit hex is opaque.
function dartColor(hex, where) {
  const m = String(hex).match(HEX)
  if (!m) fail(`${where}: "${hex}" is not a 6- or 8-digit hex colour`, 2)
  const v = m[1].toUpperCase()
  return `0x${v.length === 6 ? `FF${v}` : v}`
}

function readOverrides(path) {
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    fail(`could not read ${path}: ${e.message}`)
  }
  const out = { light: {}, dark: {} }
  for (const brightness of ['light', 'dark']) {
    const block = raw[brightness] ?? {}
    for (const [role, value] of Object.entries(block)) {
      if (RETIRED[role]) {
        fail(
          `${brightness}.${role} was removed from ColorScheme in Flutter 3.22 — `
          + `use ${RETIRED[role]} instead. Emitting it would produce code that does not compile.`
        )
      }
      if (!ROLES.includes(role)) {
        fail(
          `${brightness}.${role} is not a ColorScheme role. An unknown role would be dropped `
          + `silently and the design would quietly not apply. Known roles: ${ROLES.join(', ')}`
        )
      }
      out[brightness][role] = dartColor(value, `${brightness}.${role}`)
    }
  }
  return out
}

function schemeFor(brightness, seed, overrides) {
  const lines = [
    `  static ColorScheme _${brightness}Scheme() {`,
    '    final base = ColorScheme.fromSeed(',
    `      seedColor: const Color(${seed}),`,
    `      brightness: Brightness.${brightness}`,
    '    );'
  ]
  const keys = ROLES.filter(r => overrides[brightness][r])
  if (keys.length === 0) {
    lines.push('    return base;')
  } else {
    lines.push('    // Roles the design explicitly diverges on. Everything else is derived')
    lines.push('    // from the seed — re-running this emitter reproduces it exactly.')
    lines.push('    return base.copyWith(')
    keys.forEach((r, i) => {
      lines.push(`      ${r}: const Color(${overrides[brightness][r]})${i === keys.length - 1 ? '' : ','}`)
    })
    lines.push('    );')
  }
  lines.push('  }')
  return lines.join('\n')
}

let values
try {
  ;({ values } = parseArgs({
    options: {
      seed: { type: 'string' },
      overrides: { type: 'string' },
      font: { type: 'string' },
      out: { type: 'string', default: 'lib/core/design/app_theme.dart' },
      help: { type: 'boolean', default: false }
    }
  }))
} catch (e) {
  fail(`bad arguments: ${e.message}`, 2)
}

if (values.help || !values.seed) {
  console.log("Usage: emit_theme.mjs --seed '#6750A4' [--overrides tokens.json] [--font 'Inter'] [--out <path>]")
  process.exit(values.help ? 0 : 2)
}

const seed = dartColor(values.seed, '--seed')
const overrides = values.overrides ? readOverrides(values.overrides) : { light: {}, dark: {} }
const fontLine = values.font ? `\n    fontFamily: '${values.font.replace(/'/g, "\\'")}',` : ''

const file = `// GENERATED by flutter-figma-handoff — do not edit by hand.
// Re-run: node emit_theme.mjs --seed '${values.seed}'${values.overrides ? ` --overrides ${values.overrides}` : ''}
//
// ColorScheme.fromSeed plus the roles the design explicitly diverges on. A seed
// change legitimately moves roles nobody edited — that is the trade this approach
// makes, and it is why the output order is fixed: the diff stays reviewable.
import 'package:flutter/material.dart';

abstract final class AppTheme {
  static ThemeData get light => _build(_lightScheme());
  static ThemeData get dark => _build(_darkScheme());

  static ThemeData _build(ColorScheme scheme) => ThemeData(
    colorScheme: scheme,
    useMaterial3: true,${fontLine}
  );

${schemeFor('light', seed, overrides)}

${schemeFor('dark', seed, overrides)}
}
`

mkdirSync(dirname(values.out), { recursive: true })
writeFileSync(values.out, file)
const n = ROLES.filter(r => overrides.light[r]).length + ROLES.filter(r => overrides.dark[r]).length
console.log(`[emit-theme] wrote ${values.out} — seed ${values.seed}, ${n} explicit override(s)`)
