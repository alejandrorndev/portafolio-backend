import { DataSource } from 'typeorm'
import { InitialSchema1755600000000 } from '@/infrastructure/database/migrations/1755600000000-InitialSchema'
import {
  ExperienceOrmEntity,
  IconCatalogOrmEntity,
  ProfileOrmEntity,
  ProjectOrmEntity,
  SkillCategoryOrmEntity,
  SkillItemOrmEntity,
  UserOrmEntity,
} from '@/infrastructure/database/orm'

/*
 * -----------------------------------------------------------------------------
 * Postgres de verdad para los tests de integracion.
 * -----------------------------------------------------------------------------
 * No se usa SQLite en memoria, que seria mas rapido: no tiene `jsonb`, ni
 * `text[]`, ni restricciones DEFERRABLE. Probar ahi seria probar otro sistema, y
 * justo las partes que este proyecto apoya en la base de datos —los CHECK y el
 * reordenamiento diferido— son las que SQLite no sabe hacer.
 *
 * Estos tests corren contra una base APARTE (`DB_DATABASE_NAME_TEST`), no contra
 * la de desarrollo. La razon es que `resetSchema` ejecuta
 * `DROP SCHEMA public CASCADE`, y la instancia de Postgres de una maquina de
 * trabajo suele alojar muchas bases: apuntar los tests a la equivocada no seria
 * un test que falla, seria una base de datos perdida.
 * -----------------------------------------------------------------------------
 */

/** Sufijo obligatorio del nombre de la base de pruebas. */
const REQUIRED_SUFFIX = '_test'

interface TestDatabaseConfig {
  host: string
  port: number
  username: string
  password: string
  database: string
}

function readConfig(): TestDatabaseConfig {
  const database = process.env['DB_DATABASE_NAME_TEST'] ?? 'portafolio_test'

  /*
   * El cinturon de seguridad. No es paranoia decorativa: basta un `.env` copiado
   * de otro proyecto para que estos tests apunten a una base con datos reales, y
   * lo primero que hacen es borrar el esquema.
   */
  if (!database.endsWith(REQUIRED_SUFFIX)) {
    throw new Error(
      `DB_DATABASE_NAME_TEST es "${database}" y debe terminar en "${REQUIRED_SUFFIX}". ` +
        'Los tests de integracion borran el esquema completo, asi que solo corren ' +
        'contra una base dedicada a pruebas.',
    )
  }

  if (database === process.env['DB_DATABASE_NAME']) {
    throw new Error(
      'DB_DATABASE_NAME_TEST no puede ser la misma base que DB_DATABASE_NAME: ' +
        'los tests borrarian los datos de desarrollo.',
    )
  }

  return {
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    username: process.env['DB_USERNAME'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
    database,
  }
}

export function createTestDataSource(): DataSource {
  const config = readConfig()

  return new DataSource({
    type: 'postgres',
    ...config,
    entities: [
      ProfileOrmEntity,
      ProjectOrmEntity,
      ExperienceOrmEntity,
      IconCatalogOrmEntity,
      SkillCategoryOrmEntity,
      SkillItemOrmEntity,
      UserOrmEntity,
    ],
    migrations: [InitialSchema1755600000000],
    synchronize: false,
  })
}

/**
 * Crea la base de pruebas si no existe.
 *
 * Se conecta a `postgres` para poder ejecutar CREATE DATABASE, que no se puede
 * correr desde dentro de la base que se esta creando. Asi `pnpm test:e2e`
 * funciona en una maquina nueva y en CI sin un paso manual previo.
 */
export async function ensureTestDatabase(): Promise<void> {
  const config = readConfig()
  const admin = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: 'postgres',
  })

  await admin.initialize()

  try {
    const existing = await admin.query<{ datname: string }[]>(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [config.database],
    )

    if (existing.length === 0) {
      // El nombre no puede ir parametrizado en un CREATE DATABASE; ya se
      // valido que termina en `_test` y viene de una variable de entorno, no de
      // una peticion.
      await admin.query(`CREATE DATABASE "${config.database}"`)
    }
  } finally {
    await admin.destroy()
  }
}

/**
 * Deja el esquema recien migrado.
 *
 * Se ejecuta la migracion en vez de `synchronize`: asi los tests validan el
 * esquema que de verdad va a produccion, con sus CHECK, en lugar de uno que
 * TypeORM deduce de los decoradores y que no los tiene.
 */
export async function resetSchema(dataSource: DataSource): Promise<void> {
  await dataSource.query('DROP SCHEMA public CASCADE')
  await dataSource.query('CREATE SCHEMA public')
  await dataSource.runMigrations()
}

/** Vacia las tablas entre tests, sin volver a migrar. */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "skill_items", "skill_categories", "icon_catalog", "projects", "experience", "profile", "users" CASCADE',
  )
}

/**
 * Siembra los iconos que un test vaya a usar.
 *
 * `skill_items.icon` es FK contra `icon_catalog`, asi que sin esto cualquier
 * insercion de skills falla — que es exactamente lo que se quiere en produccion.
 */
export async function seedIcons(dataSource: DataSource, names: string[]): Promise<void> {
  for (const name of names) {
    await dataSource.query('INSERT INTO "icon_catalog" ("name") VALUES ($1)', [name])
  }
}
