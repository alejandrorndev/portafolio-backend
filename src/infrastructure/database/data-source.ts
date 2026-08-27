import { DataSource } from 'typeorm'
import { InitialSchema1755600000000 } from './migrations/1755600000000-InitialSchema'
import {
  ExperienceOrmEntity,
  IconCatalogOrmEntity,
  ProfileOrmEntity,
  ProjectOrmEntity,
  SkillCategoryOrmEntity,
  SkillItemOrmEntity,
} from './orm/content.orm-entity'
import { UserOrmEntity } from './orm/user.orm-entity'

/*
 * DataSource para la CLI de TypeORM (migration:run, migration:revert).
 *
 * Los imports son relativos y no con el alias `@/`: este archivo lo carga la
 * CLI con ts-node, fuera del contenedor de Nest, y resolver `@/` ahi obligaria a
 * arrastrar tsconfig-paths solo para esto.
 *
 * Las migraciones se listan de forma explicita en vez de con un glob: un glob
 * sobre `dist` funciona en produccion y falla en local —o al reves— segun si el
 * proyecto esta compilado, y el sintoma es "no hay migraciones pendientes"
 * cuando si las hay.
 */
/*
 * Aqui no hay ConfigModule que valide el entorno, asi que la comprobacion es
 * explicita. Una migracion que arranca sin saber a que base apunta es peor que
 * una que no arranca.
 */
function required(name: string): string {
  const value = process.env[name]

  if (value === undefined || value === '') {
    throw new Error(`Falta ${name}: la CLI de TypeORM no sabe a que base conectarse`)
  }

  return value
}

/*
 * Un unico export de DataSource, sin `export default` duplicado: la CLI de
 * TypeORM rechaza el archivo con "must contain only one export of DataSource".
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: required('DB_HOST'),
  port: Number(process.env['DB_PORT'] ?? 5432),
  username: required('DB_USERNAME'),
  password: required('DB_PASSWORD'),
  database: required('DB_DATABASE_NAME'),
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
  // Nunca. En desarrollo parece comodo, pero acostumbra a que el esquema
  // aparezca solo, y el dia del primer deploy no hay ninguna migracion escrita.
  synchronize: false,
  ssl: process.env['NODE_ENV'] === 'production',
})
