import argon2 from 'argon2'
import { env } from '../config/env.js'

// argon2id with OWASP-baseline parameters (tunable via env). The alpine
// Dockerfile relies on argon2's bundled musl prebuild — re-verify prebuild
// coverage on any argon2 major bump (no C++ toolchain in node:22-alpine).
const options = {
  // argon2 exports argon2id typed as a plain number; narrow it to the literal
  // union the options type expects. (argon2id is also argon2's default, but
  // keep it explicit — the ADR names argon2id specifically.)
  type: argon2.argon2id as 0 | 1 | 2,
  memoryCost: env.ARGON2_MEMORY_COST,
  timeCost: env.ARGON2_TIME_COST,
  parallelism: env.ARGON2_PARALLELISM
}

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options)
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
