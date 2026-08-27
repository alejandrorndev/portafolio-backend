import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

/*
 * -----------------------------------------------------------------------------
 * Swagger UI en /docs.
 * -----------------------------------------------------------------------------
 * No es solo documentacion: mientras no exista el panel de administracion de la
 * Fase 2, esta pagina ES el panel. Desde aqui se crea un proyecto, se edita el
 * perfil y se reordena la experiencia.
 *
 * Por eso se declara el esquema `bearerAuth`: el boton "Authorize" guarda el JWT
 * del login y a partir de ahi las escrituras se pueden ejecutar desde el
 * navegador.
 *
 * PENDIENTE (Etapa 4-5): proteger la ruta con basic auth usando las credenciales
 * del administrador. Hoy `setupSwagger` solo se invoca fuera de produccion, asi
 * que la exposicion no existe todavia; el dia que se publique, publicarla sin
 * candado seria regalar el mapa completo de la API de escritura.
 * -----------------------------------------------------------------------------
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('API del portafolio')
    .setDescription(
      'Contenido del portafolio de Alejandro Restrepo Naranjo: perfil, proyectos, ' +
        'experiencia y skills. Lectura publica, escritura autenticada.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // El nombre se referencia desde @ApiBearerAuth() en los controllers de
      // admin, asi que cambiarlo aqui los desconecta en silencio.
      'bearerAuth',
    )
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
    },
  })
}
