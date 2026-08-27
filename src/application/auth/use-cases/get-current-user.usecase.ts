import { Inject, Injectable } from '@nestjs/common'
import type { Actor, PublicUser } from '@/domain/entities'
import { UnauthorizedError } from '@/domain/errors'
import { USER_REPOSITORY, type IUserRepository } from '@/domain/ports'

/**
 * Los datos frescos del usuario autenticado.
 *
 * A diferencia de la autorizacion, esto SI va a la base de datos: el panel de la
 * Fase 2 lo usa para saber que botones mostrar, y ahi importa el estado real y no
 * el que tenia el token cuando se emitio.
 *
 * Si la cuenta desaparecio o quedo desactivada mientras el token seguia vigente,
 * la respuesta es 401: el token es valido, pero detras ya no hay nadie.
 */
@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(actor: Actor): Promise<PublicUser> {
    const user = await this.users.findById(actor.id)

    if (user === null) throw new UnauthorizedError()

    user.ensureCanLogin()

    return user.toPublic()
  }
}
