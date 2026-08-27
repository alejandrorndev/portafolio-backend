import type { ConfigService } from '@nestjs/config'
import type { EnsureBootstrapAdminUseCase } from '@/application/users/use-cases'
import type { Env } from '@/infrastructure/config/env.schema'
import { BootstrapAdminService } from './bootstrap-admin.service'

/*
 * Este servicio es puro cableado: lee dos variables y llama a un caso de uso. Se
 * prueba igual porque el cableado es donde vive el error mas facil de cometer —
 * pasar credenciales a medias— y ese error no se nota hasta que alguien intenta
 * entrar y no puede.
 */
describe('BootstrapAdminService', () => {
  const configWith = (values: Partial<Env>): ConfigService<Env, true> =>
    ({
      get: (key: keyof Env) => values[key],
    }) as unknown as ConfigService<Env, true>

  const useCase = () =>
    ({ execute: jest.fn().mockResolvedValue('created') }) as unknown as EnsureBootstrapAdminUseCase

  it('pasa las credenciales cuando estan las dos variables', async () => {
    const ensureAdmin = useCase()

    await new BootstrapAdminService(
      ensureAdmin,
      configWith({ ADMIN_EMAIL: 'admin@portafolio.local', ADMIN_PASSWORD_HASH: '$2b$12$hash' }),
    ).onApplicationBootstrap()

    expect(ensureAdmin.execute).toHaveBeenCalledWith({
      email: 'admin@portafolio.local',
      passwordHash: '$2b$12$hash',
    })
  })

  it.each([
    ['solo el correo', { ADMIN_EMAIL: 'admin@portafolio.local' }],
    ['solo el hash', { ADMIN_PASSWORD_HASH: '$2b$12$hash' }],
    ['ninguna de las dos', {}],
  ])('pasa null con %s', async (_label, values) => {
    // A medias no sirve: un correo sin hash no permite entrar, y con hash sin
    // correo no se sabe quien es. El caso de uso avisa por consola al recibir null.
    const ensureAdmin = useCase()

    await new BootstrapAdminService(ensureAdmin, configWith(values)).onApplicationBootstrap()

    expect(ensureAdmin.execute).toHaveBeenCalledWith(null)
  })
})
