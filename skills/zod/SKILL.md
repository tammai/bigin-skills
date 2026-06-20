# Zod — TypeScript-first Schema Validation
# Zod — Xác thực schema ưu tiên TypeScript

> Zod is a TypeScript-first schema declaration and validation library. Define a schema once — use it for runtime validation **and** static type inference.

---

## Installation

```bash
pnpm add zod
```

No config file needed. Works in browser, Node, and Cloudflare Workers/Pages.

---

## Core Concepts

### Define a schema

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string().datetime().optional(),
})
```

### Infer TypeScript type

```typescript
type User = z.infer<typeof UserSchema>
// { id: number; name: string; email: string; role: 'admin'|'user'|'guest'; createdAt?: string }
```

**Rule: never write a manual `type` or `interface` for data that has a Zod schema — always infer.**

### Parse and validate

```typescript
// parse — throws ZodError on failure
const user = UserSchema.parse(rawData)

// safeParse — returns { success, data } or { success: false, error }
const result = UserSchema.safeParse(rawData)
if (!result.success) {
  console.error(result.error.flatten())
} else {
  const user = result.data   // typed as User
}
```

---

## Primitive Types

```typescript
z.string()
z.number()
z.boolean()
z.date()
z.bigint()
z.symbol()
z.undefined()
z.null()
z.void()
z.any()
z.unknown()
z.never()
```

---

## String Refinements

```typescript
z.string().min(1)               // non-empty
z.string().max(255)
z.string().email()
z.string().url()
z.string().uuid()
z.string().cuid()
z.string().regex(/^[A-Z]{3}$/)
z.string().startsWith('prefix_')
z.string().includes('keyword')
z.string().trim()               // pre-process: strip whitespace before validation
z.string().toLowerCase()        // pre-process: normalize case
z.string().datetime()           // ISO 8601
z.string().ip()                 // IPv4 or IPv6
```

---

## Number Refinements

```typescript
z.number().int()
z.number().positive()
z.number().negative()
z.number().nonnegative()
z.number().min(0)
z.number().max(100)
z.number().multipleOf(5)
z.number().finite()
z.number().safe()               // within Number.MIN_SAFE_INTEGER .. MAX_SAFE_INTEGER
```

---

## Object Schemas

```typescript
const Schema = z.object({
  name: z.string(),
  address: z.object({           // nested
    street: z.string(),
    city: z.string(),
  }),
})

// Extend
const AdminSchema = UserSchema.extend({ permissions: z.array(z.string()) })

// Merge two objects
const merged = SchemaA.merge(SchemaB)

// Pick / omit fields
const PublicUser = UserSchema.pick({ id: true, name: true })
const WithoutPassword = UserSchema.omit({ password: true })

// Partial (all optional)
const PatchUser = UserSchema.partial()

// Partial specific fields
const PartialName = UserSchema.partial({ name: true })

// Required (all required, removes optional)
UserSchema.required()

// Strip unknown keys (default), pass-through, or strict
UserSchema.strip()       // default: removes unknown keys
UserSchema.passthrough() // keeps unknown keys
UserSchema.strict()      // throws on unknown keys
```

---

## Array Schemas

```typescript
z.array(z.string())
z.array(z.string()).min(1)      // non-empty
z.array(z.string()).max(10)
z.array(z.string()).length(5)   // exactly 5
z.array(z.string()).nonempty()  // shorthand for .min(1)

// Typed tuple
z.tuple([z.string(), z.number(), z.boolean()])
```

---

## Optional, Nullable, Default

```typescript
z.string().optional()           // string | undefined
z.string().nullable()           // string | null
z.string().nullish()            // string | null | undefined

z.string().default('hello')     // provides default when undefined
z.number().default(0)

// Unwrap optional/nullable
z.string().optional().unwrap()  // → z.string()
```

---

## Union, Discriminated Union, Intersection

```typescript
// Union
const StringOrNumber = z.union([z.string(), z.number()])
const StringOrNumber2 = z.string().or(z.number())   // shorthand

// Discriminated union (more performant — use when shapes differ by a tag field)
const Shape = z.discriminatedUnion('type', [
  z.object({ type: z.literal('circle'), radius: z.number() }),
  z.object({ type: z.literal('rect'), width: z.number(), height: z.number() }),
])

// Intersection
const Combined = z.intersection(SchemaA, SchemaB)
const Combined2 = SchemaA.and(SchemaB)
```

---

## Enum and Literal

```typescript
z.enum(['admin', 'user', 'guest'])
z.literal('active')
z.literal(42)
z.literal(true)

// Extract the enum values as a readonly array
const roles = z.enum(['admin', 'user', 'guest'])
type Role = z.infer<typeof roles>   // 'admin' | 'user' | 'guest'
roles.options                       // ['admin', 'user', 'guest']
```

---

## Record and Map

```typescript
z.record(z.string())            // Record<string, string>
z.record(z.string(), z.number()) // Record<string, number>
z.map(z.string(), z.number())   // Map<string, number>
z.set(z.string())               // Set<string>
```

---

## Transform and Preprocess

```typescript
// transform: change the output type
const StringToNumber = z.string().transform(val => parseInt(val, 10))
type Result = z.infer<typeof StringToNumber>  // number

// preprocess: run before validation (coerce types from form inputs)
const CoercedDate = z.preprocess(val => new Date(val as string), z.date())

// Shorthand coercion (Zod v3.20+)
z.coerce.number()    // Number(input) before validating
z.coerce.string()    // String(input)
z.coerce.date()      // new Date(input)
z.coerce.boolean()   // Boolean(input)
```

---

## Refinement (Custom Validation)

```typescript
const Password = z.string()
  .min(8, 'At least 8 characters')
  .refine(val => /[A-Z]/.test(val), 'Needs an uppercase letter')
  .refine(val => /[0-9]/.test(val), 'Needs a number')

// superRefine for multiple errors or conditional logic
const Dates = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
}).superRefine((data, ctx) => {
  if (data.endDate <= data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endDate must be after startDate',
      path: ['endDate'],
    })
  }
})
```

---

## Error Handling

```typescript
const result = UserSchema.safeParse(rawInput)

if (!result.success) {
  // Flat errors — best for form field display
  const flat = result.error.flatten()
  // { formErrors: string[], fieldErrors: { name?: string[], email?: string[] } }

  // Formatted errors — nested object matching schema shape
  const formatted = result.error.format()

  // All issues — raw array
  result.error.issues.forEach(issue => {
    console.log(issue.path, issue.message, issue.code)
  })
}
```

---

## Nuxt / Vue Integration Patterns

### 1. Form validation with Nuxt UI + VeeValidate

```typescript
// composables/useLoginForm.ts
import { z } from 'zod'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export function useLoginForm() {
  return useForm({ validationSchema: toTypedSchema(LoginSchema) })
}
```

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
const { handleSubmit, defineField, errors } = useLoginForm()

const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const onSubmit = handleSubmit(async (values) => {
  // values is typed as LoginInput
  await login(values)
})
</script>
```

### 2. Form validation — native (no VeeValidate)

```typescript
// Simpler approach for small forms
const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email(),
})

const errors = ref<Record<string, string>>({})

function validate(input: unknown) {
  const result = schema.safeParse(input)
  if (!result.success) {
    errors.value = Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v?.[0] ?? ''])
    )
    return null
  }
  errors.value = {}
  return result.data
}
```

### 3. Nitro API route validation (Fullstack MVP)

```typescript
// server/api/users.post.ts
import { z } from 'zod'

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user']).default('user'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = CreateUserSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Validation Error',
      data: result.error.flatten().fieldErrors,
    })
  }

  const { name, email, role } = result.data  // fully typed
  // ... save to DB
})
```

### 4. Validate external API responses

```typescript
// composables/useProducts.ts — guard against API shape changes
import { z } from 'zod'

const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
})

const ProductsResponseSchema = z.array(ProductSchema)
export type Product = z.infer<typeof ProductSchema>

export function useProducts() {
  return useQuery({
    key: ['products'],
    async query() {
      const raw = await $fetch('https://api.example.com/products')
      return ProductsResponseSchema.parse(raw)  // throws if shape is wrong
    },
  })
}
```

### 5. Shared schemas (server + client)

```typescript
// shared/schemas/user.ts   ← works in both Nuxt app/ and server/
import { z } from 'zod'

export const UserSchema = z.object({ ... })
export type User = z.infer<typeof UserSchema>
```

Nuxt v4 `shared/` directory is auto-imported on both sides — ideal for schema files.

---

## Drizzle + Zod (Fullstack MVP with D1)

```typescript
// server/database/schema.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { users } from './tables'

// Auto-generate Zod schemas from Drizzle table definitions
export const InsertUserSchema = createInsertSchema(users, {
  email: z.string().email(),    // override with stricter validation
})
export const SelectUserSchema = createSelectSchema(users)

export type InsertUser = z.infer<typeof InsertUserSchema>
export type SelectUser = z.infer<typeof SelectUserSchema>
```

Install: `pnpm add drizzle-zod`

---

## Testing with Zod (Vitest)

```typescript
// tests/schemas/user.test.ts
import { describe, it, expect } from 'vitest'
import { UserSchema } from '~/shared/schemas/user'

describe('UserSchema', () => {
  it('accepts valid user', () => {
    const result = UserSchema.safeParse({ id: 1, name: 'Alice', email: 'a@b.com', role: 'user' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = UserSchema.safeParse({ id: 1, name: 'Alice', email: 'not-email', role: 'user' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.email).toBeDefined()
  })
})
```

---

## Common Patterns Quick Reference

| Goal | Pattern |
|------|---------|
| Infer type from schema | `type T = z.infer<typeof Schema>` |
| Non-empty string | `z.string().min(1)` |
| Optional field | `z.string().optional()` |
| Field with default | `z.string().default('draft')` |
| Enum | `z.enum(['a', 'b', 'c'])` |
| Partial update (PATCH) | `Schema.partial()` |
| Pick public fields | `Schema.pick({ id: true, name: true })` |
| Coerce form input number | `z.coerce.number()` |
| Custom error message | `z.string().min(1, 'Required')` |
| Cross-field validation | `.superRefine((data, ctx) => { ... })` |
| API route validation | `safeParse(body)` → 422 on failure |
| Drizzle table → schema | `createInsertSchema(table)` from `drizzle-zod` |
