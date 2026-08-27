import 'reflect-metadata'

import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import type { Env } from '@/infrastructure/config/env.schema'
import { DomainErrorFilter, HttpErrorFilter } from '@/interface/http/filters'
import { setupSwagger } from '@/interface/http/swagger'

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

  app.useGlobalPipes(
    new ValidationPipe({
      // Descarta lo que no este declarado en el DTO...
      whitelist: true,
      // ...y ademas lo rechaza con un 400. Un campo mal escrito que se ignora en
      // silencio es un cambio que el editor cree haber guardado y no se guardo.
      forbidNonWhitelisted: true,
      // Convierte el cuerpo en la clase del DTO, que es lo que hace funcionar
      // @Type() y la validacion de objetos anidados.
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  /*
   * Un unico sitio donde los errores de dominio se vuelven codigos HTTP, y otro
   * que le da la misma forma a los que no vienen del dominio (validacion,
   * limitador, ruta inexistente). Asi el panel maneja una sola forma de error, no
   * dos segun de donde venga el fallo.
   *
   * El orden importa: Nest recorre los filtros de derecha a izquierda buscando el
   * mas especifico, y DomainError no es una HttpException, asi que cada uno atrapa
   * lo suyo.
   */
  app.useGlobalFilters(new HttpErrorFilter(), new DomainErrorFilter())

  setupSwagger(app, {
    isProduction: config.get('NODE_ENV', { infer: true }) === 'production',
    user: config.get('DOCS_USER', { infer: true }),
    password: config.get('DOCS_PASSWORD', { infer: true }),
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
