// Viola la regla a proposito: un controller llama a un caso de uso, no a la
// base de datos.
import { TypeOrmDatabaseProbe } from '@/infrastructure/database/typeorm-database.probe'

export const violacion = TypeOrmDatabaseProbe
