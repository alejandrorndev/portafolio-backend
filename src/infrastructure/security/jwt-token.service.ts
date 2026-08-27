import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UnauthorizedError } from '@/domain/errors'
import type { ITokenService, SignedToken, TokenPayload } from '@/domain/ports'
import { isKnownRole } from './known-role.util'

/**
 * Firma y verificacion de JWT.
 *
 * El payload lleva `{ sub, email, role }` y nada mas: ni el hash, ni el estado de
 * activacion. Lo que viaja en un token viaja en claro —esta firmado, no cifrado—
 * asi que solo va lo que no importa que se lea.
 */
@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly expiresInSeconds: number,
  ) {}

  async sign(payload: TokenPayload): Promise<SignedToken> {
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: this.expiresInSeconds })

    return { accessToken, expiresIn: this.expiresInSeconds }
  }

  /**
   * Devuelve el payload o lanza `UnauthorizedError`.
   *
   * Cualquier motivo de fallo —firma invalida, token expirado, payload con una
   * forma que no reconocemos— se traduce al MISMO error. Distinguirlos le diria a
   * quien prueba tokens que tan cerca estuvo.
   */
  async verify(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(token)

      const sub = payload['sub']
      const email = payload['email']
      const role = payload['role']

      if (typeof sub !== 'string' || typeof email !== 'string' || !isKnownRole(role)) {
        throw new UnauthorizedError()
      }

      return { sub, email, role }
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error

      throw new UnauthorizedError()
    }
  }
}
