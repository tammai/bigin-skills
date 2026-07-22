import { eq } from 'drizzle-orm'
import { db } from '../../../shared/db/client.js'
import { can } from '../../../shared/auth/rbac.js'
import { notFound, unauthorized } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { users, outboxEvents } from '../infrastructure/users.schema.js'

export interface Actor {
  sub: string
  roles: string[]
}

// The producing half of the outbox → relay → inbox example. In ONE transaction:
// hard-delete the user row AND insert a `user.erased` outbox row. Either both
// land or neither does — the event can't be lost relative to the deletion.
//
// RBAC is checked HERE (in the use-case), not in the route: self-erase is
// allowed; erasing anyone else needs the users:erase permission.
export async function eraseUser(userId: string, actor: Actor): Promise<void> {
  if (actor.sub !== userId && !can(actor.roles, 'users:erase')) {
    throw unauthorized(ErrorCode.Unauthorized, 'not allowed to erase this user')
  }

  await db.transaction(async (tx) => {
    const deleted = await tx.delete(users).where(eq(users.id, userId)).returning({ id: users.id })
    if (deleted.length === 0) throw notFound(ErrorCode.UserNotFound, 'user not found')

    await tx.insert(outboxEvents).values({
      eventType: 'user.erased',
      schemaVersion: 1,
      payload: { userId }
    })
  })
}
