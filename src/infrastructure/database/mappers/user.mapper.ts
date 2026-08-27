import type { DeepPartial } from 'typeorm'
import { User } from '@/domain/entities'
import type { UserOrmEntity } from '@/infrastructure/database/orm'

/** La fila que el mapper lee, sin las columnas que gestiona Postgres. */
export type UserRow = Omit<UserOrmEntity, 'createdAt' | 'updatedAt'>

export const UserMapper = {
  toDomain(row: UserRow): User {
    return User.create({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      isActive: row.isActive,
    })
  },

  toOrm(user: User): DeepPartial<UserOrmEntity> {
    const primitives = user.toPrimitives()

    return {
      id: primitives.id,
      email: primitives.email,
      passwordHash: primitives.passwordHash,
      role: primitives.role,
      isActive: primitives.isActive,
    }
  },
}
