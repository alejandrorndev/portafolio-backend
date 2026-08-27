import { Inject, Injectable } from '@nestjs/common'
import type { PublicUser } from '@/domain/entities'
import { UnauthorizedError } from '@/domain/errors'
import {
  HASHER,
  TOKEN_SERVICE,
  USER_REPOSITORY,
  type IHasher,
  type ITokenService,
  type IUserRepository,
} from '@/domain/ports'

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  accessToken: string
  expiresIn: number
  user: PublicUser
}

/*
 * Hash de descarte, con la forma de uno real.
 *
 * Cuando el correo no existe se compara la contraseña contra ESTE hash en lugar
 * de responder de inmediato. El resultado es el mismo —no entra— pero el tiempo
 * de respuesta tambien: sin esto, un correo inexistente contesta en un
 * milisegundo y uno registrado en trescientos, y esa diferencia convierte el
 * login en un verificador de correos registrados que se puede automatizar.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.O0jL2/lVUS/EM6HIL2/D8yfCvSBPfPu'

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email)

    const matches = await this.hasher.compare(input.password, user?.passwordHash ?? DUMMY_HASH)

    // Un unico error para las tres razones posibles: el correo no existe, la
    // contraseña no coincide, o la cuenta esta desactivada. Distinguirlas seria
    // decirle a quien prueba correos ajenos cual de las tres acerto.
    if (user === null || !matches) {
      throw new UnauthorizedError()
    }

    user.ensureCanLogin()

    const signed = await this.tokens.sign({
      sub: user.id,
      email: user.email.value,
      role: user.role.name,
    })

    return { ...signed, user: user.toPublic() }
  }
}
