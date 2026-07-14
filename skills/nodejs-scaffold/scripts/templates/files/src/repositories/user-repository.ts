import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users, type NewUser, type User } from '../db/schema.js'

export const userRepository = {
  async create(input: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(input).returning()
    return user
  },

  async findById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user
  }
}
