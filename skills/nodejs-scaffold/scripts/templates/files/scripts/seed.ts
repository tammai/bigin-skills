import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../src/shared/db/client.js'
import { hashPassword } from '../src/shared/auth/password.js'
import { users } from '../src/modules/users/infrastructure/users.schema.js'
import { posts } from '../src/modules/posts/infrastructure/posts.schema.js'

const SEED_EMAIL = 'admin@example.com'
const SEED_PASSWORD = 'changeme123'

// Idempotent — safe to re-run against a DB that already has the seed data
// (checks before inserting rather than relying on ON CONFLICT, since the
// email uniqueness constraint is a partial index scoped to deleted_at IS
// NULL, which ON CONFLICT can't target without duplicating that predicate).
async function main(): Promise<void> {
  const [existingAdmin] = await db.select().from(users).where(eq(users.email, SEED_EMAIL))
  const admin =
    existingAdmin ??
    (
      await db
        .insert(users)
        .values({ email: SEED_EMAIL, name: 'Admin', passwordHash: await hashPassword(SEED_PASSWORD), roles: ['admin'] })
        .returning()
    )[0]

  const [existingPost] = await db.select().from(posts).where(eq(posts.authorId, admin.id))
  if (!existingPost) {
    await db
      .insert(posts)
      .values({ title: 'Welcome', body: 'This is a seeded post.', authorId: admin.id, createdBy: admin.id })
  }

  console.log(`seed complete: ${SEED_EMAIL} / ${SEED_PASSWORD}`)
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
