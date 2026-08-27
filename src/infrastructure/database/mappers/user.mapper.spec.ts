import { User } from '@/domain/entities'
import { UserMapper, type UserRow } from './user.mapper'

const row = {
  id: '33333333-3333-3333-3333-333333333333',
  email: 'admin@correo.co',
  passwordHash: '$2b$12$hash',
  role: 'admin',
  isActive: true,
} satisfies UserRow

describe('UserMapper', () => {
  it('ida y vuelta sin perder nada', () => {
    expect(UserMapper.toOrm(UserMapper.toDomain(row))).toEqual({
      id: row.id,
      email: 'admin@correo.co',
      passwordHash: '$2b$12$hash',
      role: 'admin',
      isActive: true,
    })
  })

  it('devuelve una entidad de dominio, no la fila', () => {
    expect(UserMapper.toDomain(row)).toBeInstanceOf(User)
  })

  it('normaliza el correo al leerlo de la base de datos', () => {
    const upper = { ...row, email: 'Admin@Correo.CO' } satisfies UserRow

    expect(UserMapper.toOrm(UserMapper.toDomain(upper)).email).toBe('admin@correo.co')
  })

  it('respeta un usuario desactivado', () => {
    const disabled = { ...row, isActive: false } satisfies UserRow

    expect(UserMapper.toDomain(disabled).isActive).toBe(false)
  })
})
