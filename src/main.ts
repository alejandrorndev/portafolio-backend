import 'reflect-metadata'

import { Logger, RequestMethod } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import type { Env } from '@/infrastructure/config/env.schema'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService<Env, true>)

  /*
   * Todo lo publico vive bajo /v1. Los chequeos de salud quedan fuera: los
   * consume la infraestructura (Render, los cron del keepalive), no un cliente
   * de la API, y versionar una URL de monitoreo obligaria a cambiar los cron
   * cada vez que la API cambie de version.
   */
  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/db', method: RequestMethod.GET },
    ],
  })

  const origins = config.get('CORS_ORIGINS', { infer: true })
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true })
  }

  app.enableShutdownHooks()

  const port = config.get('PORT', { infer: true })
  await app.listen(port)

  new Logger('bootstrap').log(`API escuchando en el puerto ${port}`)
}

void bootstrap()
