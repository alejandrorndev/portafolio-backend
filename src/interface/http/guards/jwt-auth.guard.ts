import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common'
import { AuthenticateTokenUseCase } from '@/application/auth/use-cases'
import { UnauthorizedError } from '@/domain/errors'
import { ACTOR_REQUEST_KEY, type RequestWithActor } from './request-with-actor'

/**
 * Exige un token valido y deja el actor en la peticion.
 *
 * Lanza `UnauthorizedError` del dominio y no `UnauthorizedException` de Nest: el
 * filtro de errores (§6.2) ya sabe traducirlo a 401 con el cuerpo uniforme
 * `{ statusCode, code, message }`, y asi un 401 que sale de un guard y uno que
 * sale de un caso de uso son indistinguibles para el cliente.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateTokenUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithActor>()
    const header = request.headers['authorization']

    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Falta el token de acceso')
    }

    const token = header.slice('Bearer '.length).trim()

    if (token.length === 0) {
      throw new UnauthorizedError('Falta el token de acceso')
    }

    request[ACTOR_REQUEST_KEY] = await this.authenticate.execute(token)

    return true
  }
}
