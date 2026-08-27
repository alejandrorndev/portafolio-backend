import { randomUUID } from 'node:crypto'
import { UnauthorizedError } from '@/domain/errors'
import { Email } from '@/domain/value-objects/email'
import { parseBoolean, parseText } from '@/domain/value-objects/primitives'
import { Role } from '@/domain/value-objects/role'
import { Actor } from './actor.entity'

export interface UserInput {
  id?: unknown
  email: unknown
  passwordHash: unknown
  role: unknown
  isActive?: unknown
}

export interface UserPrimitives {
  id: string
  email: string
  passwordHash: string
  role: string
  isActive: boolean
}

/** Lo que se puede mostrar de un usuario. Nunca incluye el hash. */
export interface PublicUser {
  id: string
  email: string
  role: string
  isActive: boolean
}

export class User {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly passwordHash: string,
    readonly role: Role,
    readonly isActive: boolean,
  ) {}

  static create(input: UserInput): User {
    return new User(
      input.id === undefined || input.id === null ? randomUUID() : parseText(input.id, 'user.id'),
      Email.of(input.email, 'user.email'),
      // El dominio no hashea: recibe el hash ya calculado a traves del puerto
      // IHasher. Lo unico que exige es que no llegue vacio, porque un hash
      // vacio convertiria el login en "cualquier contraseña sirve".
      parseText(input.passwordHash, 'user.passwordHash'),
      Role.of(input.role, 'user.role'),
      input.isActive === undefined ? true : parseBoolean(input.isActive, 'user.isActive'),
    )
  }

  /**
   * Un usuario desactivado no entra.
   *
   * El error es el mismo `UnauthorizedError` genérico que el de credenciales
   * incorrectas: decirle "tu cuenta esta desactivada" a quien prueba correos
   * ajenos le confirma que ese correo existe.
   */
  ensureCanLogin(): void {
    if (!this.isActive) {
      throw new UnauthorizedError()
    }
  }

  /**
   * La identidad que se pasa a los casos de uso.
   *
   * Los permisos se preguntan al `Actor` y no al `User`: asi la regla vive en un
   * solo sitio y da igual si quien actua viene de la base de datos o del payload
   * de un token.
   */
  toActor(): Actor {
    return Actor.of({ id: this.id, email: this.email.value, role: this.role.name })
  }

  withRole(role: Role): User {
    return new User(this.id, this.email, this.passwordHash, role, this.isActive)
  }

  withPasswordHash(passwordHash: string): User {
    return new User(
      this.id,
      this.email,
      parseText(passwordHash, 'user.passwordHash'),
      this.role,
      this.isActive,
    )
  }

  activate(): User {
    return new User(this.id, this.email, this.passwordHash, this.role, true)
  }

  deactivate(): User {
    return new User(this.id, this.email, this.passwordHash, this.role, false)
  }

  /** Forma segura para respuestas y tokens: sin el hash. */
  toPublic(): PublicUser {
    return {
      id: this.id,
      email: this.email.value,
      role: this.role.name,
      isActive: this.isActive,
    }
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this.id,
      email: this.email.value,
      passwordHash: this.passwordHash,
      role: this.role.name,
      isActive: this.isActive,
    }
  }
}
