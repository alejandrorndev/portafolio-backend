import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { ThrottlerModule } from '@nestjs/throttler'
import {
  AuthenticateTokenUseCase,
  GetCurrentUserUseCase,
  LoginUseCase,
} from '@/application/auth/use-cases'
import { HASHER, TOKEN_SERVICE } from '@/domain/ports'
import type { Env } from '@/infrastructure/config/env.schema'
import { BcryptHasher } from '@/infrastructure/security/bcrypt-hasher.service'
import { JwtTokenService } from '@/infrastructure/security/jwt-token.service'
import { JwtAuthGuard, RolesGuard } from '@/interface/http/guards'
import { DatabaseModule } from './database.module'

@Module({
  imports: [
    DatabaseModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
      }),
    }),

    /*
     * El limitador se declara con NOMBRE y no como limite global: aplicado a todo
     * dejaria la lectura publica del portafolio en cinco peticiones por minuto. Lo
     * pide solo la ruta de login, con @UseGuards(ThrottlerGuard).
     */
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: 'login',
          ttl: 60_000,
          limit: config.get('LOGIN_RATE_LIMIT', { infer: true }),
        },
      ],
    }),
  ],
  providers: [
    { provide: HASHER, useClass: BcryptHasher },
    {
      provide: TOKEN_SERVICE,
      inject: [JwtService, ConfigService],
      useFactory: (jwt: JwtService, config: ConfigService<Env, true>) =>
        new JwtTokenService(jwt, config.get('JWT_EXPIRES_IN_SECONDS', { infer: true })),
    },
    LoginUseCase,
    AuthenticateTokenUseCase,
    GetCurrentUserUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    HASHER,
    TOKEN_SERVICE,
    LoginUseCase,
    AuthenticateTokenUseCase,
    GetCurrentUserUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
