import { Logger, type INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import basicAuth from 'express-basic-auth'

/*
 * -----------------------------------------------------------------------------
 * Swagger UI en /docs.
 * -----------------------------------------------------------------------------
 * No es solo documentacion: mientras no exista el panel de la Fase 2, esta pagina
 * ES el panel. Desde aqui se crea un proyecto, se edita el perfil y se reordena la
 * experiencia. De ahi el esquema `bearerAuth` con `persistAuthorization`: se pega
 * el token del login una vez y las escrituras se ejecutan desde el navegador.
 *
 * En produccion va detras de basic auth con credenciales PROPIAS
 * (DOCS_USER/DOCS_PASSWORD) y no con las del administrador. Dos razones:
 *
 *   · La contraseña del admin se guarda hasheada, y comparar con bcrypt en cada
 *     peticion pondria ~300 ms sobre cada archivo estatico que carga Swagger UI.
 *   · Una credencial aparte se puede rotar o revocar sin tocar la cuenta que
 *     administra el contenido.
 *
 * Si en produccion faltan esas variables, la pagina NO se monta. Falla cerrado:
 * publicar el mapa completo de la API de escritura sin candado es peor que no
 * tener documentacion.
 * -----------------------------------------------------------------------------
 */

export interface SwaggerAccess {
  isProduction: boolean
  user: string | undefined
  password: string | undefined
}

export function setupSwagger(app: INestApplication, access: SwaggerAccess): void {
  const logger = new Logger('swagger')
  const hasCredentials = access.user !== undefined && access.password !== undefined

  if (access.isProduction && !hasCredentials) {
    logger.warn(
      'No se monta /docs: en produccion requiere DOCS_USER y DOCS_PASSWORD. ' +
        'La API sigue funcionando; lo que no se publica es su documentacion.',
    )

    return
  }

  if (hasCredentials) {
    app.use(
      ['/docs', '/docs-json'],
      basicAuth({
        challenge: true,
        realm: 'API del portafolio',
        users: { [access.user as string]: access.password as string },
      }),
    )
  }

  const config = new DocumentBuilder()
    .setTitle('API del portafolio')
    .setDescription(
      'Contenido del portafolio de Alejandro Restrepo Naranjo: perfil, proyectos, ' +
        'experiencia y skills. Lectura publica, escritura autenticada.\n\n' +
        'Para escribir: POST /v1/auth/login, copiar `accessToken` y pegarlo en ' +
        '**Authorize**.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // El nombre se referencia desde @ApiBearerAuth() en los controllers de
      // admin, asi que cambiarlo aqui los desconecta en silencio.
      'bearerAuth',
    )
    .addTag('contenido publico', 'Lectura sin autenticacion, resuelta a un idioma')
    .addTag('auth', 'Inicio de sesion')
    .addTag('admin · proyectos', 'Escritura. Borrar exige rol admin')
    .addTag('admin · experiencia', 'Escritura. Borrar exige rol admin')
    .addTag('admin · skills', 'Escritura. Borrar exige rol admin')
    .addTag('admin · perfil', 'Escritura')
    .addTag('admin · usuarios', 'Solo admin')
    .addTag('health', 'Chequeos de salud para el host y el keepalive')
    .build()

  const document = SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'API del portafolio',
    swaggerOptions: {
      // Sobrevive al refresco: sin esto hay que volver a pegar el token en cada
      // recarga, y editando contenido se recarga mucho.
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
    },
  })

  logger.log(hasCredentials ? '/docs montado con basic auth' : '/docs montado sin candado (dev)')
}
