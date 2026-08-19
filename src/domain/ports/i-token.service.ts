import type { RoleName } from '@/domain/value-objects/role'

/** Lo que viaja dentro del token. Nunca el hash de la contraseña. */
export interface TokenPayload {
  sub: string
  email: string
  role: RoleName
}

export interface SignedToken {
  accessToken: string
  /** Segundos de vigencia, para que el cliente sepa cuando volver a entrar. */
  expiresIn: number
}

export interface ITokenService {
  sign(payload: TokenPayload): Promise<SignedToken>

  /** Devuelve el payload o lanza `UnauthorizedError`. */
  verify(token: string): Promise<TokenPayload>
}

export const TOKEN_SERVICE = 'ITokenService'
