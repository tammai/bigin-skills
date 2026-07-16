# Idiom translation

The port must read like it was born in the target stack. Transliteration —
copying the source's *shape* instead of its *intent* — is the #1 quality
failure in ports. Before porting each module, ask: "how would a senior
<target-stack> dev solve this requirement from scratch?" and port to that.

General rules (any pair):

- Port the *requirement in the contract*, not the source's workarounds. If the
  source has a mutex because its framework had a race, and the target doesn't
  have that race, the mutex is not a feature.
- Source-stack utility layers (their homegrown lodash, their result-wrapper)
  do not get ported. Target-stack equivalents or nothing.
- Error-handling style, logging style, and test style come from the Phase 5
  vertical slice — never from the source.

## JS/TS (Express/Nest) → Go

| Source pattern | Wrong (transliteration) | Right (Go idiom) |
|---|---|---|
| async/await chains | goroutine-per-await, channels everywhere | plain sequential calls; goroutines only for real concurrency |
| try/catch | panic/recover as flow control | `if err != nil` returns; wrap with `%w` |
| Middleware stacks mutating `req` | context stuffed with everything | typed values via small context keys, or explicit params |
| Dynamic JSON blobs | `map[string]interface{}` throughout | structs + `encoding/json` tags; blobs only at true dynamic edges |
| ORM (Mongoose/Prisma) | reflection-heavy ORM in Go | pgx + sqlc (or the team's agreed data layer) |
| Class-based services + DI container | interfaces for everything + DI framework | constructor injection with plain structs; interfaces only at real seams |
| `null`/`undefined` dance | pointer soup `***T` | zero values where valid; pointers or `sql.Null*` only where absence is meaningful |
| Event emitters | homemade pub/sub | channels for in-process; real queue if the source used one |

## Python → TypeScript/Node

| Source pattern | Wrong | Right |
|---|---|---|
| duck typing / `**kwargs` | `any` everywhere | discriminated unions, explicit options objects |
| decorators for validation | decorator emulation | schema validation at the boundary (e.g. TypeBox/zod) per team standard |
| sync blocking code | wrapping everything in `Promise.resolve` | genuinely async I/O; CPU-bound work stays sync or moves to workers |
| module-level singletons | mutable module globals | explicit construction/injection at the composition root |
| exceptions for control flow | throw/catch business logic | typed results or thrown errors per the Phase 5 pattern — one, consistently |

## Go → TS, TS → Python, others

Same method: list the source's load-bearing patterns during Phase 5, decide
the target-native equivalent for each, write the mapping table into the
vertical-slice PR description, and hold every Phase 6 module to it. If a
pattern has no clean target equivalent, that's an ADAPT item in FEATURES.md
with the difference recorded — not a silent improvisation.

## Frontend framework → framework (e.g. React → Vue/Nuxt)

- Hooks → composables, but re-derive the *data flow*, don't mirror hook
  granularity one-to-one.
- Global stores: port the state shape from the contract, not the store
  library's structure (Redux slices are not Pinia stores).
- Component boundaries may legitimately move — the contract is the view's
  behavior and consumed data, not the source's component tree.
