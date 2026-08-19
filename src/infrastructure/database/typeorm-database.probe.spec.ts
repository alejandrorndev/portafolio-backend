import { Logger } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { TypeOrmDatabaseProbe } from './typeorm-database.probe'

describe('TypeOrmDatabaseProbe', () => {
  const probeWith = (query: jest.Mock) =>
    new TypeOrmDatabaseProbe({ query } as unknown as DataSource)

  it('devuelve true cuando la consulta funciona', async () => {
    await expect(probeWith(jest.fn().mockResolvedValue([{ '1': 1 }])).isReachable()).resolves.toBe(
      true,
    )
  })

  it('devuelve false y no propaga el error cuando la conexion falla', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const probe = probeWith(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(probe.isReachable()).resolves.toBe(false)
  })
})
