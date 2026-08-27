import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from '@/infrastructure/config/env.schema'
import { AuthModule } from '@/infrastructure/modules/auth.module'
import { ContentModule } from '@/infrastructure/modules/content.module'
import { HealthModule } from '@/infrastructure/modules/health.module'
import { UsersModule } from '@/infrastructure/modules/users.module'

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
    ContentModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
