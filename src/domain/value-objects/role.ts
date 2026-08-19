import { InvalidContentError } from '@/domain/errors'

export const ROLES = ['admin', 'editor'] as const

export type RoleName = (typeof ROLES)[number]

/**
 * Rol de un usuario, con sus permisos como comportamiento.
 *
 * Los permisos viven aqui y no en el guard porque son una regla de negocio: el
 * guard es la barrera del transporte HTTP, pero el mismo permiso tiene que
 * cumplirse cuando un caso de uso lo invoque un script o un test.
 *
 * El unico permiso que separa a los dos roles es borrar. Crear y editar son
 * reversibles —se corrige el texto y ya—, pero borrar un proyecto destruye
 * contenido bilingue que costo escribir y no hay historial que lo recupere.
 */
export class Role {
  static readonly ADMIN = new Role('admin')
  static readonly EDITOR = new Role('editor')

  private constructor(readonly name: RoleName) {}

  static of(input: unknown, field = 'role'): Role {
    if (input === 'admin') return Role.ADMIN
    if (input === 'editor') return Role.EDITOR

    throw new InvalidContentError(
      `${field}: "${String(input)}" no es un rol valido. Los validos son ${ROLES.join(', ')}`,
    )
  }

  get isAdmin(): boolean {
    return this.name === 'admin'
  }

  canWriteContent(): boolean {
    return true
  }

  canDeleteContent(): boolean {
    return this.isAdmin
  }

  canManageUsers(): boolean {
    return this.isAdmin
  }

  toString(): string {
    return this.name
  }

  equals(other: Role): boolean {
    return this.name === other.name
  }
}
