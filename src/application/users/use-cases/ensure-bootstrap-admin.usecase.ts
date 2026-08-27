import { Inject, Injectable, Logger } from '@nestjs/common'
import { User } from '@/domain/entities'
import { USER_REPOSITORY, type IUserRepository } from '@/domain/ports'

export interface BootstrapCredentials {
  email: string
  passwordHash: string
}

export type BootstrapResult = 'created' | 'already-exists' | 'not-configured'

/*
 * -----------------------------------------------------------------------------
 * El primer administrador.
 * -----------------------------------------------------------------------------
 * Un despliegue nuevo tiene la base vacia, asi que no habria con que autenticarse
 * para crear el primer usuario. Este caso de uso rompe ese circulo al arrancar.
 *
 * Es idempotente y no pisa nada: si ya existe algun admin, no hace nada, ni
 * siquiera si el hash de la variable de entorno cambio. La consecuencia hay que
 * aceptarla y esta documentada — cambiar la contraseña se hace por API, no
 * editando el entorno— y el escape, si se pierde el acceso, es un UPDATE en el
 * editor SQL del proveedor.
 *
 * Sin credenciales configuradas NO revienta el arranque: la API de lectura
 * publica funciona igual, y lo que no puede pasar es que falle en silencio. De ahi
 * el aviso, que es el mismo criterio que usa el front con Resend y Upstash.
 * -----------------------------------------------------------------------------
 */
@Injectable()
export class EnsureBootstrapAdminUseCase {
  private readonly logger = new Logger(EnsureBootstrapAdminUseCase.name)

  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

  async execute(credentials: BootstrapCredentials | null): Promise<BootstrapResult> {
    if ((await this.users.countActiveAdmins()) > 0) return 'already-exists'

    if (credentials === null) {
      this.logger.warn(
        'No hay ningun administrador y no hay credenciales de arranque: NADIE puede ' +
          'autenticarse. Define ADMIN_EMAIL y ADMIN_PASSWORD_HASH (pnpm secrets) y ' +
          'reinicia. La lectura publica funciona igual.',
      )

      return 'not-configured'
    }

    const admin = User.create({
      email: credentials.email,
      passwordHash: credentials.passwordHash,
      role: 'admin',
    })

    await this.users.save(admin)

    this.logger.log(`Administrador inicial creado: ${admin.email.value}`)

    return 'created'
  }
}
