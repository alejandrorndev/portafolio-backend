import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { Env } from '@/infrastructure/config/env.schema'
import { DATABASE_PROBE } from '@/domain/ports/i-database.probe'
import { TypeOrmDatabaseProbe } from '@/infrastructure/database/typeorm-database.probe'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL', { infer: true }),

        /*
         * `synchronize` en false SIEMPRE, en todos los entornos. En desarrollo
         * parece comodo, pero acostumbra al equipo a que el esquema aparezca
         * solo, y el dia del primer deploy no hay ninguna migracion escrita.
         */
        synchronize: false,
        autoLoadEntities: true,

        /*
         * El pooler de Supabase (puerto 6543) limita las conexiones, y varias
         * instancias con pools grandes las agotan. Cinco alcanza de sobra para
         * un portafolio y deja margen para las migraciones.
         */
        extra: { max: 5 },

        // Los proveedores gestionados exigen TLS y presentan certificados que
        // la cadena de confianza local no reconoce.
        ssl: config.get('NODE_ENV', { infer: true }) === 'production',
      }),
    }),
  ],
  providers: [{ provide: DATABASE_PROBE, useClass: TypeOrmDatabaseProbe }],
  exports: [DATABASE_PROBE],
})
export class DatabaseModule {}
