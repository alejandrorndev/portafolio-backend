import { Injectable, Logger } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { IDatabaseProbe } from '@/domain/ports/i-database.probe'

/** Implementacion del puerto: un `SELECT 1` contra la conexion activa. */
@Injectable()
export class TypeOrmDatabaseProbe implements IDatabaseProbe {
  private readonly logger = new Logger(TypeOrmDatabaseProbe.name)

  constructor(private readonly dataSource: DataSource) {}

  async isReachable(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1')
      return true
    } catch (error) {
      // El motivo se queda en el servidor. Al cliente le basta un 503: los
      // detalles de una falla de conexion no le sirven y si le dicen de mas.
      this.logger.error('La base de datos no responde', error)
      return false
    }
  }
}
