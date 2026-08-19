import { ServiceUnavailableException } from '@nestjs/common'
import type { CheckDatabaseHealthUseCase } from '@/application/health/use-cases/check-database-health.usecase'
import { HealthController } from './health.controller'

describe('HealthController', () => {
  const controllerWith = (reachable: boolean) =>
    new HealthController({
      execute: jest.fn().mockResolvedValue(reachable),
    } as unknown as CheckDatabaseHealthUseCase)

  it('/health responde ok sin consultar la base de datos', () => {
    const useCase = { execute: jest.fn() }
    const controller = new HealthController(useCase as unknown as CheckDatabaseHealthUseCase)

    expect(controller.live()).toEqual({ status: 'ok' })
    // Es el punto de todo el diseño de §5.3: el keepalive no debe despertar la
    // base de datos.
    expect(useCase.execute).not.toHaveBeenCalled()
  })

  it('/health/db responde ok cuando la base de datos esta alcanzable', async () => {
    await expect(controllerWith(true).ready()).resolves.toEqual({ status: 'ok' })
  })

  it('/health/db responde 503 cuando no lo esta', async () => {
    await expect(controllerWith(false).ready()).rejects.toThrow(ServiceUnavailableException)
  })
})
