import 'dotenv/config'
import { z } from 'zod'

// zod stays for exactly one job: fail-closed validation of process env at boot.
// Route validation is TypeBox's job now, not zod's.
const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('{{CORS}}'),
  // no default — a missing JWT_SECRET must crash the process, never silently
  // fall back to a guessable value.
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),
  ARGON2_MEMORY_COST: z.coerce.number().default(19456),
  ARGON2_TIME_COST: z.coerce.number().default(2),
  ARGON2_PARALLELISM: z.coerce.number().default(1),
  IDEMPOTENCY_KEY_TTL_HOURS: z.coerce.number().default(24)
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim())
}
