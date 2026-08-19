import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from '@/infrastructure/config/env.schema'
import { HealthModule } from '@/infrastructure/modules/health.module'

/**
 * Raiz de composicion. No contiene logica: solo decide que modulos existen.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    HealthModule,
  ],
})
export class AppModule {}
