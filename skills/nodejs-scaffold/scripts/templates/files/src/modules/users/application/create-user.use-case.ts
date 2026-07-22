import { hashPassword } from '../../../shared/auth/password.js'
import { conflict } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { usersRepository } from '../infrastructure/users.repository.js'
import { toUserView, type UserView } from '../domain/user.entity.js'

export interface CreateUserInput {
  email: string
  name: string
  password: string
  roles?: string[]
  actorId?: string | null
}

export async function createUser(input: CreateUserInput): Promise<UserView> {
  const existing = await usersRepository.findByEmail(input.email)
  if (existing) throw conflict(ErrorCode.UserEmailTaken, 'email is already registered')

  const passwordHash = await hashPassword(input.password)
  const user = await usersRepository.create({
    email: input.email,
    name: input.name,
    passwordHash,
    roles: input.roles ?? ['user'],
    createdBy: input.actorId ?? null
  })
  return toUserView(user)
}
