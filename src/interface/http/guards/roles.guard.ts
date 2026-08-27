import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ForbiddenActionError, UnauthorizedError } from '@/domain/errors'
import type { RoleName } from '@/domain/value-objects/role'
import { ACTOR_REQUEST_KEY, type RequestWithActor } from './request-with-actor'
import { ROLES_METADATA } from './roles.decorator'

/*
 * -----------------------------------------------------------------------------
 * El guard DENIEGA cuando la ruta no declara roles.
 * -----------------------------------------------------------------------------
 * Falla cerrado a proposito, y es la decision mas importante de este archivo. Un
 * guard que permite por omision convierte un olvido en un agujero: se agrega un
 * controller de admin, alguien no pone `@Roles(...)`, y el endpoint queda abierto
 * a cualquiera con un token — incluido un editor que solo debia poder editar.
 *
 * Al revés, el olvido produce un 403 molesto que aparece en el primer intento y se
 * arregla en un minuto.
 * -----------------------------------------------------------------------------
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<RoleName[] | undefined>(ROLES_METADATA, [
      context.getHandler(),
      context.getClass(),
    ])

    if (allowed === undefined || allowed.length === 0) {
      throw new ForbiddenActionError(
        'esta operacion: la ruta no declara roles permitidos (falta @Roles)',
      )
    }

    const request = context.switchToHttp().getRequest<RequestWithActor>()
    const actor = request[ACTOR_REQUEST_KEY]

    // Sin actor significa que JwtAuthGuard no corrio antes. Es un error de
    // configuracion del modulo, y responderlo como 401 es mas honesto que
    // asumir un rol.
    if (actor === undefined) {
      throw new UnauthorizedError('Falta el token de acceso')
    }

    if (!allowed.includes(actor.role.name)) {
      throw new ForbiddenActionError(`esta operacion con el rol "${actor.role.name}"`)
    }

    return true
  }
}
