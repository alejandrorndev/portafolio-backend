import { Inject, Injectable } from '@nestjs/common'
import { Actor } from '@/domain/entities'
import { TOKEN_SERVICE, type ITokenService } from '@/domain/ports'

/**
 * Convierte un token en el actor que lo presenta.
 *
 * NO consulta la base de datos, y esa es la decision de §6.1 del diseño: el token
 * es la fuente de autoridad durante su vigencia. La contrapartida esta
 * documentada — degradar o desactivar a alguien tarda hasta 8 horas en surtir
 * efecto— y el escape para cortar el acceso ya es rotar `JWT_SECRET`, que
 * invalida todos los tokens de golpe.
 *
 * Verificar contra la base en cada peticion eliminaria la ventana a cambio de una
 * consulta por llamada, que es lo que un token sin estado existe para evitar.
 */
@Injectable()
export class AuthenticateTokenUseCase {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: ITokenService) {}

  async execute(token: string): Promise<Actor> {
    const payload = await this.tokens.verify(token)

    return Actor.of({ id: payload.sub, email: payload.email, role: payload.role })
  }
}
