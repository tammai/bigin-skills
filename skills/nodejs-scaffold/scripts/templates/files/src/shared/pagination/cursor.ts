import { AppError } from '../errors/app-error.js'
import { ErrorCode } from '../errors/codes.js'

export type SortDirection = 'asc' | 'desc'
export interface SortSpec {
  column: string
  direction: SortDirection
}

export class CursorMismatchError extends AppError {
  constructor() {
    super(400, ErrorCode.CursorMismatch, 'cursor does not match the requested sort order')
  }
}

// base64url(JSON) of { sort, values }. The sort string is baked into the cursor
// so a client that flips ?sort= mid-pagination gets a clean 400 instead of
// silently-wrong rows.
export function encodeCursor(sort: string, values: (string | number)[]): string {
  return Buffer.from(JSON.stringify({ sort, values }), 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string, expectedSort: string): (string | number)[] {
  let parsed: { sort: string; values: (string | number)[] }
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      sort: string
      values: (string | number)[]
    }
  } catch {
    throw new CursorMismatchError()
  }
  if (parsed.sort !== expectedSort || !Array.isArray(parsed.values)) throw new CursorMismatchError()
  return parsed.values
}

export function serializeSort(sorts: SortSpec[]): string {
  return sorts.map((s) => (s.direction === 'desc' ? `-${s.column}` : s.column)).join(',')
}

// `-col` = descending, `col` = ascending. Columns are checked against a
// per-endpoint allowlist so a caller can never sort by an arbitrary column.
//
// ALLOWLIST INVARIANT (spike-verified pitfall): the allowlist must contain ONLY
// NON-NULLABLE columns. A nullable sort column silently drops every NULL row
// past page 1 — `NULL > 'x'` is SQL UNKNOWN, which WHERE treats as false, so
// pagination stops early with no error. The ADR's audit/domain sort columns
// (created_at, name, title) are all NOT NULL. Adding a nullable column here
// requires NULLS FIRST/LAST-aware branches in buildKeysetWhere FIRST — do not
// just append it.
export function parseSort(sortParam: string | undefined, allowlist: readonly string[], fallback: string): SortSpec[] {
  const raw = sortParam && sortParam.length > 0 ? sortParam : fallback
  const specs: SortSpec[] = []
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const direction: SortDirection = trimmed.startsWith('-') ? 'desc' : 'asc'
    const column = trimmed.replace(/^-/, '')
    if (!allowlist.includes(column)) {
      throw new AppError(400, ErrorCode.BadRequest, `sort column "${column}" is not allowed`)
    }
    specs.push({ column, direction })
  }
  if (specs.length === 0) throw new AppError(400, ErrorCode.BadRequest, 'invalid sort parameter')
  return specs
}

// Cursor values are JSON, so timestamps round-trip as ISO strings. postgres.js
// binds a JS string param as text, and `timestamptz > text` is a type error —
// so re-hydrate the timestamp columns to Date objects (which postgres.js binds
// as timestamptz) before they reach buildKeysetWhere. Non-timestamp columns
// (name, title, id) stay as-is.
export function hydrateCursorValues(
  sorts: SortSpec[],
  values: (string | number)[],
  timestampColumns: readonly string[]
): (string | number)[] {
  return values.map((v, i) => {
    const spec = sorts[i]
    if (spec && timestampColumns.includes(spec.column)) {
      // The runtime value is a Date; postgres.js binds it as timestamptz. The
      // (string | number) element type is a contained lie — see repositories.
      return new Date(v) as unknown as string
    }
    return v
  })
}

// ── SPIKE-VERIFIED keyset WHERE generator (verbatim) ──────────────────────
// The naive single row-comparison `(c1, c2, id) < (?, ?, ?)` only works when
// every sort column shares one direction. A mixed sort (e.g. `-created_at,name`)
// needs an OR-chain expanded per column, respecting each column's own
// direction. This generalizes to arbitrary asc/desc combinations plus the id
// tiebreaker; verified against a live Postgres table across a full 4-page
// sequence (limit=3, 10 rows with ties) for both `-created_at,name` and
// `name,-created_at` — every row returned exactly once, correct order, no
// dupes/skips.
//
// cursorValues length MUST equal sorts.length + 1 (the trailing element is the
// tiebreaker value). Returns 1-indexed `$1..$N` placeholders; callers must
// append any further params (e.g. LIMIT) AFTER these.
export function buildKeysetWhere(
  sorts: SortSpec[],
  cursorValues: (string | number)[],
  tiebreakerColumn = 'id',
  tiebreakerDirection: SortDirection = 'asc'
): { sql: string; params: (string | number)[] } {
  const allSorts = [...sorts, { column: tiebreakerColumn, direction: tiebreakerDirection }]
  const orClauses: string[] = []
  const params: (string | number)[] = []
  let paramIndex = 1
  for (let i = 0; i < allSorts.length; i++) {
    const eqParts: string[] = []
    for (let j = 0; j < i; j++) {
      eqParts.push(`${allSorts[j].column} = $${paramIndex}`)
      params.push(cursorValues[j])
      paramIndex++
    }
    const op = allSorts[i].direction === 'desc' ? '<' : '>'
    eqParts.push(`${allSorts[i].column} ${op} $${paramIndex}`)
    params.push(cursorValues[i])
    paramIndex++
    orClauses.push(`(${eqParts.join(' AND ')})`)
  }
  return { sql: orClauses.join('\n  OR '), params }
}
