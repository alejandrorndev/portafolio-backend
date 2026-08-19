import { Inject, Injectable } from '@nestjs/common'
import { DATABASE_PROBE, type IDatabaseProbe } from '@/domain/ports/i-database.probe'

/**
 * Responde si la base de datos esta alcanzable.
 *
 * No lanza excepciones HTTP: devuelve un booleano y el controller decide que
 * codigo mandar. Un caso de uso que conoce el 503 es un caso de uso que solo
 * sirve para HTTP.
 */
@Injectable()
export class CheckDatabaseHealthUseCase {
  constructor(@Inject(DATABASE_PROBE) private readonly probe: IDatabaseProbe) {}

  async execute(): Promise<boolean> {
    return this.probe.isReachable()
  }
}
