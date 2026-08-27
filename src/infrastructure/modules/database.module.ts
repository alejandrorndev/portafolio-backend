import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DATABASE_PROBE } from '@/domain/ports/i-database.probe'
import {
  EXPERIENCE_REPOSITORY,
  PROFILE_REPOSITORY,
  PROJECT_REPOSITORY,
  SKILL_CATEGORY_REPOSITORY,
  USER_REPOSITORY,
} from '@/domain/ports'
import type { Env } from '@/infrastructure/config/env.schema'
import { TypeOrmDatabaseProbe } from '@/infrastructure/database/typeorm-database.probe'
import {
  ExperienceOrmEntity,
  IconCatalogOrmEntity,
  ProfileOrmEntity,
  ProjectOrmEntity,
  SkillCategoryOrmEntity,
  SkillItemOrmEntity,
  UserOrmEntity,
} from '@/infrastructure/database/orm'
import {
  TypeOrmExperienceRepository,
  TypeOrmProfileRepository,
  TypeOrmProjectRepository,
  TypeOrmSkillCategoryRepository,
  TypeOrmUserRepository,
} from '@/infrastructure/database/repos'

/*
 * Los repositorios se registran contra los TOKENS de los puertos del dominio,
 * no contra sus clases. Es lo que permite que un caso de uso pida
 * `@Inject(PROJECT_REPOSITORY)` sin conocer TypeORM, y que en un test se le pase
 * otra implementacion sin tocar el caso de uso.
 */
const REPOSITORIES = [
  { provide: PROJECT_REPOSITORY, useClass: TypeOrmProjectRepository },
  { provide: EXPERIENCE_REPOSITORY, useClass: TypeOrmExperienceRepository },
  { provide: SKILL_CATEGORY_REPOSITORY, useClass: TypeOrmSkillCategoryRepository },
  { provide: PROFILE_REPOSITORY, useClass: TypeOrmProfileRepository },
  { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
  { provide: DATABASE_PROBE, useClass: TypeOrmDatabaseProbe },
]

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        /*
         * Se extraen a variables tipadas antes de armar el objeto: las opciones
         * de TypeORM declaran `database?: string | Uint8Array` y
         * `password?: string | (() => string)`, y el tipado contextual arrastra
         * esas uniones hasta lo que devuelve ConfigService.
         */
        const host: string = config.get('DB_HOST', { infer: true })
        const port: number = config.get('DB_PORT', { infer: true })
        const username: string = config.get('DB_USERNAME', { infer: true })
        const password: string = config.get('DB_PASSWORD', { infer: true })
        const database: string = config.get('DB_DATABASE_NAME', { infer: true })
        const isProduction = config.get('NODE_ENV', { infer: true }) === 'production'

        return {
          type: 'postgres' as const,
          host,
          port,
          username,
          password,
          database,

          entities: [
            ProfileOrmEntity,
            ProjectOrmEntity,
            ExperienceOrmEntity,
            IconCatalogOrmEntity,
            SkillCategoryOrmEntity,
            SkillItemOrmEntity,
            UserOrmEntity,
          ],

          /*
           * `synchronize` en false SIEMPRE, en todos los entornos. En desarrollo
           * parece comodo, pero acostumbra a que el esquema aparezca solo, y el
           * dia del primer deploy no hay ninguna migracion escrita.
           */
          synchronize: false,

          /*
           * El pooler de Supabase (puerto 6543) limita las conexiones, y varias
           * instancias con pools grandes las agotan. Cinco alcanza de sobra para
           * un portafolio y deja margen para las migraciones.
           */
          extra: { max: 5 },

          // Los proveedores gestionados exigen TLS.
          ssl: isProduction,
        }
      },
    }),
  ],
  providers: REPOSITORIES,
  exports: REPOSITORIES.map((repository) => repository.provide),
})
export class DatabaseModule {}
