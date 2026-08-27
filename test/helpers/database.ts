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
 * Los tests corren contra el contenedor de `pnpm db:up` en local y contra el
 * `services: postgres` de GitHub Actions en CI.
 * -----------------------------------------------------------------------------
 */

const DEFAULT_URL = 'postgres://portafolio:portafolio@localhost:5432/portafolio'

export function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    url: process.env['DATABASE_URL'] ?? DEFAULT_URL,
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
