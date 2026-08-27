import { Injectable, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EnsureBootstrapAdminUseCase,
  type BootstrapCredentials,
} from '@/application/users/use-cases'
import type { Env } from '@/infrastructure/config/env.schema'

/**
 * Crea el administrador inicial al arrancar la aplicacion.
 *
 * Vive en un servicio con el hook de ciclo de vida y no en `main.ts` por una
 * razon practica: asi tambien corre cuando la aplicacion la levanta un test o un
 * script, que son justo los sitios donde alguien esperaria poder autenticarse.
 */
@Injectable()
export class BootstrapAdminService implements OnApplicationBootstrap {
  constructor(
    private readonly ensureAdmin: EnsureBootstrapAdminUseCase,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('ADMIN_EMAIL', { infer: true })
    const passwordHash = this.config.get('ADMIN_PASSWORD_HASH', { infer: true })

    const credentials: BootstrapCredentials | null =
      email !== undefined && passwordHash !== undefined ? { email, passwordHash } : null

    await this.ensureAdmin.execute(credentials)
  }
}
