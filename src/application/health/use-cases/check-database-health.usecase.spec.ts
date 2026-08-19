import type { IDatabaseProbe } from '@/domain/ports/i-database.probe'
import { CheckDatabaseHealthUseCase } from './check-database-health.usecase'

describe('CheckDatabaseHealthUseCase', () => {
  const probeThatReturns = (reachable: boolean): IDatabaseProbe => ({
    isReachable: jest.fn().mockResolvedValue(reachable),
  })

  it('devuelve true cuando la base de datos responde', async () => {
    await expect(new CheckDatabaseHealthUseCase(probeThatReturns(true)).execute()).resolves.toBe(
      true,
    )
  })

  it('devuelve false cuando no responde', async () => {
    await expect(new CheckDatabaseHealthUseCase(probeThatReturns(false)).execute()).resolves.toBe(
      false,
    )
  })
})
