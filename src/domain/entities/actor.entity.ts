import { ForbiddenActionError } from '@/domain/errors'
import { Email } from '@/domain/value-objects/email'
import { parseText } from '@/domain/value-objects/primitives'
import { Role } from '@/domain/value-objects/role'

/*
 * -----------------------------------------------------------------------------
 * Quien esta actuando.
 * -----------------------------------------------------------------------------
 * No es lo mismo que `User`, y separarlos resuelve un problema concreto del
 * diseño. `User` es la CUENTA guardada: incluye el hash de la contraseña y el
 * estado de activacion. El `Actor` es la IDENTIDAD de quien ejecuta una
 * operacion, y eso es todo lo que un caso de uso necesita para decidir permisos.
 *
 * La diferencia importa porque los tokens son sin estado (§6.1 del diseño): la
 * peticion trae `{ sub, email, role }` y no se consulta la base de datos para
 * autorizar. Con `User` habria que inventar un hash de contraseña para construir
 * el objeto, o hacer una consulta por peticion — justo lo que el diseño decidio
 * NO hacer.
 *
 * Un `Actor` no se puede guardar y no tiene contraseña. Solo sabe quien es y que
 * le esta permitido.
 * -----------------------------------------------------------------------------
 */

export interface ActorInput {
  id: unknown
  email: unknown
  role: unknown
}

export class Actor {
  private constructor(
    readonly id: string,
    readonly email: Email,
    readonly role: Role,
  ) {}

  static of(input: ActorInput): Actor {
    return new Actor(
      parseText(input.id, 'actor.id'),
      Email.of(input.email, 'actor.email'),
      Role.of(input.role, 'actor.role'),
    )
  }

  get isAdmin(): boolean {
    return this.role.isAdmin
  }

  /** Falla si este actor no puede borrar contenido. */
  ensureCanDeleteContent(action: string): void {
    if (!this.role.canDeleteContent()) {
      throw new ForbiddenActionError(action)
    }
  }

  /** Falla si este actor no puede administrar usuarios. */
  ensureCanManageUsers(action: string): void {
    if (!this.role.canManageUsers()) {
      throw new ForbiddenActionError(action)
    }
  }

  toJSON(): { id: string; email: string; role: string } {
    return { id: this.id, email: this.email.value, role: this.role.name }
  }
}
