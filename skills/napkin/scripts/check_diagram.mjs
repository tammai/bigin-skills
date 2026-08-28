#!/usr/bin/env node
// Geometry checker for hand-authored SVG diagrams.
//
// SVG <text> does not wrap. Every visual defect below came from that one fact and was
// found by eye, one screenshot at a time, until this existed:
//   - a label longer than its box, running past both rounded corners
//   - one box widened to fit its label, breaking a column's alignment
//   - an edge attached at an eyeballed coordinate that stopped being the centre
//     when a box height changed
//
// Usage:  node check_diagram.mjs <file.svg|file.html> [...]
//         --width-factor=N   per-char width as a fraction of font-size (default 0.50)
//         --pad=N            required slack inside a box, px (default 16)
//         --json             machine-readable output
// Exit 1 if any diagram has a finding. Zero dependencies.

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const files = args.filter(a => !a.startsWith('--'))
const opt = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : dflt
}
const WIDTH_FACTOR = opt('width-factor', 0.50)
const PAD = opt('pad', 16)
const AS_JSON = args.includes('--json')

if (!files.length) {
  console.error('usage: node check_diagram.mjs <file.svg|file.html> [...] [--width-factor=0.5] [--pad=16] [--json]')
  process.exit(2)
}

// Attribute reader that tolerates any order and single or double quotes.
function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`))
  return m ? m[1] : null
}
const num = (v) => (v === null ? null : Number(v))

// Strip tags and decode the few entities a diagram actually uses, so a label's
// character count reflects what renders rather than what is typed.
function plain(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-zA-Z]+;/g, 'x')
    .trim()
}

// An <svg> written inside a JavaScript string is not a diagram — it is source code that
// happens to contain markup. Detected by the quote-plus-concatenation shape, and skipped
// rather than reported, because treating it as malformed is a false positive.
function looksLikeJsString(block) {
  return /['"]\s*\+\s*$/m.test(block) || /^\s*['"]/.test(block)
}

function findSvgs(text) {
  const out = []
  const re = /<svg\b/g
  let m
  while ((m = re.exec(text)) !== null) {
    const close = text.indexOf('</svg>', m.index)
    if (close === -1) continue
    out.push({ start: m.index, body: text.slice(m.index, close + 6) })
  }
  return out
}

const findings = []
let checked = 0, skipped = 0

for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf-8')
  } catch (err) {
    console.error(`Cannot read ${file}: ${err.code === 'ENOENT' ? 'no such file' : err.message}`)
    process.exit(2)
  }
  const lineAt = (i) => text.slice(0, i).split('\n').length

  for (const { start, body } of findSvgs(text)) {
    const openTag = body.slice(0, body.indexOf('>') + 1)
    const vb = attr(openTag, 'viewBox')
    if (!vb) { skipped++; continue }
    if (looksLikeJsString(body)) { skipped++; continue }

    const [, , vwRaw, vhRaw] = vb.trim().split(/[\s,]+/).map(Number)
    const VW = vwRaw, VH = vhRaw
    const where = `${file}:${lineAt(start)}`
    checked++
    const add = (kind, msg) => findings.push({ where, kind, msg })

    // --- shapes -----------------------------------------------------------------
    const rects = []
    for (const m of body.matchAll(/<rect\b[^>]*>/g)) {
      const x = num(attr(m[0], 'x')), y = num(attr(m[0], 'y'))
      const w = num(attr(m[0], 'width')), h = num(attr(m[0], 'height'))
      if ([x, y, w, h].some(v => v === null || Number.isNaN(v))) continue
      rects.push({ x, y, w, h })
    }

    for (const r of rects) {
      if (r.x < 0 || r.y < 0 || r.x + r.w > VW || r.y + r.h > VH) {
        add('bounds', `rect at (${r.x},${r.y}) ${r.w}x${r.h} extends outside the ${VW}x${VH} viewBox`)
      }
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j]
        const overlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
        if (overlap) add('overlap', `rect (${a.x},${a.y}) overlaps rect (${b.x},${b.y})`)
      }
    }

    // --- uniform column width ----------------------------------------------------
    // Boxes sharing a left edge are a column, and a column reads as one only if the
    // boxes line up. Widening one to fit its label trades a text bug for this one.
    // Group by CENTRE, not by left edge: widening a box to fit its label also moves its
    // x to keep it centred, so a left-edge grouping never sees the two as one column and
    // misses the exact defect this check exists for.
    const byCentre = new Map()
    for (const r of rects) {
      const c = r.x + r.w / 2
      if (!byCentre.has(c)) byCentre.set(c, [])
      byCentre.get(c).push(r)
    }
    for (const [c, group] of byCentre) {
      const widths = [...new Set(group.map(r => r.w))]
      if (group.length >= 3 && widths.length > 1) {
        const odd = widths.sort((a, b) => group.filter(r => r.w === b).length - group.filter(r => r.w === a).length)
        add('column', `${group.length} boxes are centred on x=${c} but have widths ${[...widths].sort((a, b) => a - b).join(', ')} — the ${odd[odd.length - 1]}px one breaks the column; wrap or reword its label instead of widening it`)
      }
    }

    // --- label fit ---------------------------------------------------------------
    for (const m of body.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
      const tag = m[0].slice(0, m[0].indexOf('>') + 1)
      const x = num(attr(tag, 'x')), y = num(attr(tag, 'y'))
      const fs = num(attr(tag, 'font-size')) ?? 12
      if (x === null || y === null) continue
      const label = plain(m[1])
      if (!label) continue
      const est = label.length * fs * WIDTH_FACTOR
      const host = rects.find(r => r.x <= x && x <= r.x + r.w && r.y - 4 <= y && y <= r.y + r.h + 4)
      if (host && est > host.w - PAD) {
        add('overflow', `"${label.slice(0, 52)}" needs ~${Math.round(est)}px in a ${host.w}px box — wrap it onto another <text> line and grow the box (SVG text does not wrap)`)
      }
      // text-anchor decides which side of x the label grows from; SVG defaults to start,
      // and a left-anchored label read as centred looks like it runs off the left edge.
      const anchor = (attr(tag, "text-anchor") ?? (/text-anchor\s*:\s*([a-z]+)/.exec(tag) || [])[1] ?? "start").trim()
      const x0 = anchor === "middle" ? x - est / 2 : anchor === "end" ? x - est : x
      const x1 = x0 + est
      if (!host && (x0 < 0 || x1 > VW)) {
        add('bounds', `free label "${label.slice(0, 40)}" extends past the viewBox`)
      }
    }

    // --- edge centring -----------------------------------------------------------
    // A straight segment that lands on a box face should meet it at the face's midpoint.
    // Eyeballed coordinates survive until a height changes, then silently go off-centre.
    for (const m of body.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']+)["'][^>]*>/g)) {
      const d = m[1]
      if (/[Zz]/.test(d)) continue // closed shape: a diamond or an arrowhead
      const pts = []
      let cx = null, cy = null
      for (const seg of d.matchAll(/([MHVLmhvl])\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?/g)) {
        const [, op, a, b] = seg
        const A = Number(a), B = b === undefined ? null : Number(b)
        if (op === 'M' || op === 'L') { cx = A; cy = B }
        else if (op === 'H') cx = A
        else if (op === 'V') cy = A
        else continue
        if (cx !== null && cy !== null) pts.push({ x: cx, y: cy })
      }
      for (const p of [pts[0], pts[pts.length - 1]].filter(Boolean)) {
        for (const r of rects) {
          const onLeft = Math.abs(p.x - r.x) <= 4, onRight = Math.abs(p.x - (r.x + r.w)) <= 4
          const onTop = Math.abs(p.y - r.y) <= 4, onBottom = Math.abs(p.y - (r.y + r.h)) <= 4
          const midY = r.y + r.h / 2, midX = r.x + r.w / 2
          if ((onLeft || onRight) && p.y > r.y && p.y < r.y + r.h && Math.abs(p.y - midY) > 2) {
            add('edge', `edge meets a box side at y=${p.y} but that face's centre is y=${midY} — compute it from the rect`)
          }
          if ((onTop || onBottom) && p.x > r.x && p.x < r.x + r.w && Math.abs(p.x - midX) > 2) {
            add('edge', `edge meets a box face at x=${p.x} but that face's centre is x=${midX} — compute it from the rect`)
          }
        }
      }
    }
  }
}

if (AS_JSON) {
  console.log(JSON.stringify({ checked, skipped, findings }, null, 2))
} else {
  for (const f of findings) console.log(`${f.where}  [${f.kind}] ${f.msg}`)
  const note = skipped ? ` (${skipped} skipped: no viewBox, or markup inside a JS string)` : ''
  console.log(findings.length
    ? `\n${findings.length} finding(s) across ${checked} diagram(s)${note}`
    : `OK ${checked} diagram(s) clean${note}`)
  if (!AS_JSON && findings.length) {
    console.log('Label widths are estimated at ' + WIDTH_FACTOR + ' x font-size per character — approximate, so a')
    console.log('near-miss is worth checking by eye rather than trusted either way.')
  }
}
process.exit(findings.length ? 1 : 0)
