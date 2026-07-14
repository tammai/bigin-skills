import { userRepository } from '../repositories/user-repository.js'
import type { NewUser, User } from '../db/schema.js'

export const userService = {
  async create(input: NewUser): Promise<User> {
    return userRepository.create(input)
  },

  async get(id: string): Promise<User | undefined> {
    return userRepository.findById(id)
  }
}
