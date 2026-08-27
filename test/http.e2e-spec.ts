import type { Server } from 'node:http'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { DataSource } from 'typeorm'
import { createTestApp, createUserWithPassword } from './helpers/app'
import {
  createTestDataSource,
  ensureTestDatabase,
  resetSchema,
  seedIcons,
} from './helpers/database'

/*
 * -----------------------------------------------------------------------------
 * La API completa, por HTTP.
 * -----------------------------------------------------------------------------
 * Aqui no se mockea nada: sube la aplicacion entera contra un Postgres real y
 * habla con ella por HTTP. Es lo unico que prueba de verdad las piezas que solo
 * existen en el borde — el ValidationPipe, los guards, los presenters, los
 * filtros de error y el orden de las rutas.
 * -----------------------------------------------------------------------------
 */

const ADMIN = {
  email: 'admin@test.local',
  password: 'contrasena-de-prueba',
  role: 'admin',
} as const
const EDITOR = {
  email: 'editor@test.local',
  password: 'contrasena-de-prueba',
  role: 'editor',
} as const

const projectBody = (id: string) => ({
  id,
  type: { es: 'API REST · Backend', en: 'REST API · Backend' },
  title: { es: `Proyecto ${id}`, en: `Project ${id}` },
  description: { es: 'Descripción con acentos: áéíóú', en: 'Description' },
  tags: ['NestJS', 'PostgreSQL'],
  icon: '🎟️',
  gradient: ['#7c3aed', '#06b6d4'],
  links: { github: `https://github.com/a/${id}` },
})

describe('API por HTTP', () => {
  let app: INestApplication
  let dataSource: DataSource
  let adminToken: string
  let editorToken: string

  // `getHttpServer()` devuelve `any`, y supertest lo recibiria sin tipo. La
  // asercion mantiene el tipado en todas las peticiones del archivo.
  const http = () => request(app.getHttpServer() as Server)

  /*
   * Se envian SOLO email y password. Mandar el `role` de la constante fue el
   * primer fallo de esta suite: `forbidNonWhitelisted` lo rechaza con un 400, que
   * es exactamente lo que se le pide al ValidationPipe.
   */
  const login = async (credentials: { email: string; password: string }): Promise<string> => {
    const response = await http()
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200)

    return (response.body as { accessToken: string }).accessToken
  }

  beforeAll(async () => {
    await ensureTestDatabase()

    dataSource = createTestDataSource()
    await dataSource.initialize()
    await resetSchema(dataSource)
    await seedIcons(dataSource, ['nestjs-plain', 'nodejs-plain', 'fastify-plain'])
    await dataSource.destroy()

    /*
     * Limite alto: esta suite inicia sesion muchas veces —dos usuarios y varios
     * casos de error— y con el de produccion (5/min) se toparia con un 429 propio.
     * El limite en si se prueba en `login-throttle.e2e-spec.ts`.
     */
    app = await createTestApp({ loginRateLimit: 500 })

    await createUserWithPassword(app, ADMIN)
    await createUserWithPassword(app, EDITOR)

    adminToken = await login(ADMIN)
    editorToken = await login(EDITOR)
  }, 120_000)

  afterAll(async () => {
    await app.close()
  })

  describe('login', () => {
    it('devuelve un token y el usuario, sin el hash', async () => {
      const response = await http()
        .post('/v1/auth/login')
        .send({ email: ADMIN.email, password: ADMIN.password })
        .expect(200)
      const body = response.body as { accessToken: string; expiresIn: number; user: unknown }

      expect(body.accessToken.split('.')).toHaveLength(3)
      expect(body.expiresIn).toBe(28_800)
      expect(JSON.stringify(body)).not.toContain('$2b$')
    })

    it('rechaza una contraseña incorrecta con el formato uniforme de error', async () => {
      const response = await http()
        .post('/v1/auth/login')
        .send({ email: ADMIN.email, password: 'equivocada' })
        .expect(401)

      expect(response.body).toEqual({
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Credenciales invalidas',
      })
    })

    it('un correo inexistente da exactamente el mismo error', async () => {
      const response = await http()
        .post('/v1/auth/login')
        .send({ email: 'nadie@test.local', password: 'cualquiera' })
        .expect(401)

      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' })
    })

    it('un campo de mas tambien es 400', async () => {
      await http()
        .post('/v1/auth/login')
        .send({ ...ADMIN, sobra: 'esto' })
        .expect(400)
    })

    it('un cuerpo incompleto es 400 con la lista de problemas', async () => {
      const response = await http().post('/v1/auth/login').send({ email: ADMIN.email }).expect(400)

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' })
      expect((response.body as { details: string[] }).details.join(' ')).toContain('password')
    })
  })

  describe('/v1/auth/me', () => {
    it('devuelve el usuario del token', async () => {
      const response = await http()
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body).toMatchObject({ email: ADMIN.email, role: 'admin', isActive: true })
    })

    it('sin token es 401', async () => {
      await http().get('/v1/auth/me').expect(401)
    })

    it('con un token manipulado es 401', async () => {
      await http()
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken.slice(0, -3)}aaa`)
        .expect(401)
    })
  })

  describe('escritura de contenido', () => {
    it('un admin crea un proyecto y la respuesta es bilingue', async () => {
      const response = await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectBody('api-rest-eventos'))
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'api-rest-eventos',
        title: { es: 'Proyecto api-rest-eventos', en: 'Project api-rest-eventos' },
        position: 0,
      })
    })

    it('un editor tambien crea', async () => {
      await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${editorToken}`)
        .send(projectBody('carrito-compras'))
        .expect(201)
    })

    it('conserva acentos y emojis', async () => {
      const response = await http()
        .get('/v1/admin/projects/api-rest-eventos')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const body = response.body as { icon: string; description: { es: string } }

      expect(body.icon).toBe('🎟️')
      expect(body.description.es).toContain('áéíóú')
    })

    it('rechaza un id repetido con 409', async () => {
      const response = await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectBody('api-rest-eventos'))
        .expect(409)

      expect(response.body).toMatchObject({ code: 'DUPLICATE_ID' })
    })

    it('rechaza un proyecto sin enlaces con 422: la forma es valida, el dominio no lo acepta', async () => {
      const response = await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...projectBody('sin-enlaces'), links: {} })
        .expect(422)

      expect(response.body).toMatchObject({ code: 'INVALID_CONTENT' })
    })

    it('rechaza un campo desconocido con 400', async () => {
      // Un campo mal escrito que se ignora en silencio es un cambio que el editor
      // cree haber guardado.
      const response = await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...projectBody('con-basura'), titulo: 'me equivoque de nombre' })
        .expect(400)

      expect((response.body as { details: string[] }).details.join(' ')).toContain('titulo')
    })

    it('editar ignora un intento de cambiar el id', async () => {
      const response = await http()
        .put('/v1/admin/projects/api-rest-eventos')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ id: 'otro-id', icon: '🚀' })
        .expect(200)

      expect(response.body).toMatchObject({ id: 'api-rest-eventos', icon: '🚀' })
    })

    it('editar algo que no existe es 404 con el codigo del recurso', async () => {
      const response = await http()
        .put('/v1/admin/projects/fantasma')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ icon: '🚀' })
        .expect(404)

      expect(response.body).toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    })
  })

  describe('la matriz de permisos', () => {
    it('un editor NO puede borrar contenido', async () => {
      const response = await http()
        .delete('/v1/admin/projects/carrito-compras')
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403)

      expect(response.body).toMatchObject({ code: 'FORBIDDEN_ACTION' })
    })

    it('un editor NO puede ni listar usuarios', async () => {
      await http().get('/v1/admin/users').set('Authorization', `Bearer ${editorToken}`).expect(403)
    })

    it('un admin si borra, y responde 204 sin cuerpo', async () => {
      const response = await http()
        .delete('/v1/admin/projects/carrito-compras')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)

      expect(response.body).toEqual({})
    })

    it('un admin lista usuarios sin exponer hashes', async () => {
      const response = await http()
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(JSON.stringify(response.body)).not.toContain('$2b$')
    })

    it('no deja borrar al ultimo admin activo', async () => {
      /*
       * Hay dos admins: el de arranque, que crea la aplicacion al levantarse desde
       * ADMIN_EMAIL, y el de esta suite. Borrar el primero se permite; el segundo
       * ya es el ultimo y ahi salta el invariante.
       */
      const listed = await http()
        .get('/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const admins = (listed.body as { id: string; email: string; role: string }[]).filter(
        (user) => user.role === 'admin',
      )

      expect(admins.length).toBeGreaterThan(1)

      for (const admin of admins.slice(0, -1)) {
        await http()
          .delete(`/v1/admin/users/${admin.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204)
      }

      const last = admins[admins.length - 1]
      const response = await http()
        .delete(`/v1/admin/users/${last?.id ?? ''}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409)

      expect(response.body).toMatchObject({ code: 'LAST_ADMIN' })
    })
  })

  describe('el orden de las rutas', () => {
    it('PATCH /reorder no se confunde con PATCH /:id', async () => {
      // Si `:id` estuviera declarado antes, "reorder" llegaria como el id de un
      // proyecto y la respuesta seria un 404 en vez de un reordenamiento.
      await http()
        .post('/v1/admin/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(projectBody('segundo-proyecto'))
        .expect(201)

      const response = await http()
        .patch('/v1/admin/projects/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['segundo-proyecto', 'api-rest-eventos'] })
        .expect(200)

      expect((response.body as { id: string }[]).map((project) => project.id)).toEqual([
        'segundo-proyecto',
        'api-rest-eventos',
      ])
    })

    it('reordenar con una lista incompleta es 422 y dice que falta', async () => {
      const response = await http()
        .patch('/v1/admin/projects/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: ['api-rest-eventos'] })
        .expect(422)

      expect((response.body as { message: string }).message).toContain('segundo-proyecto')
    })
  })

  describe('lectura publica', () => {
    it('no pide token', async () => {
      await http().get('/v1/projects').expect(200)
    })

    it('resuelve el texto al idioma pedido', async () => {
      const [es, en] = await Promise.all([
        http().get('/v1/projects?locale=es').expect(200),
        http().get('/v1/projects?locale=en').expect(200),
      ])

      expect((es.body as { title: string }[])[0]?.title).toContain('Proyecto')
      expect((en.body as { title: string }[])[0]?.title).toContain('Project')
    })

    it('sin locale usa español, el idioma por defecto del sitio', async () => {
      const response = await http().get('/v1/projects').expect(200)

      expect((response.body as { title: string }[])[0]?.title).toContain('Proyecto')
    })

    it('un idioma que no existe es 400, no un fallback silencioso', async () => {
      const response = await http().get('/v1/projects?locale=fr').expect(400)

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' })
    })

    it('la forma publica no lleva position ni objetos bilingues', async () => {
      const response = await http().get('/v1/projects?locale=es').expect(200)
      const project = (response.body as Record<string, unknown>[])[0] ?? {}

      expect(project).not.toHaveProperty('position')
      expect(typeof project['title']).toBe('string')
      expect(project['gradient']).toEqual(['#7c3aed', '#06b6d4'])
    })

    it('trae las cabeceras de cache y un ETag', async () => {
      const response = await http().get('/v1/projects').expect(200)

      expect(response.headers['cache-control']).toBe(
        'public, max-age=60, stale-while-revalidate=300',
      )
      expect(response.headers['etag']).toBeDefined()
    })

    it('devuelve 304 cuando el cliente ya tiene la respuesta', async () => {
      const first = await http().get('/v1/projects').expect(200)

      await http()
        .get('/v1/projects')
        .set('If-None-Match', first.headers['etag'] as string)
        .expect(304)
    })

    it('un id que no existe es 404 con codigo estable', async () => {
      const response = await http().get('/v1/projects/fantasma').expect(404)

      expect(response.body).toEqual({
        statusCode: 404,
        code: 'PROJECT_NOT_FOUND',
        message: 'No existe project con id "fantasma"',
      })
    })

    it('una ruta que no existe tambien responde con el formato uniforme', async () => {
      const response = await http().get('/v1/no-existe').expect(404)

      expect(response.body).toMatchObject({ code: 'ROUTE_NOT_FOUND' })
    })
  })

  describe('skills y sus items', () => {
    beforeAll(async () => {
      await http()
        .post('/v1/admin/skills')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          id: 'backend',
          title: { es: 'Backend', en: 'Backend' },
          accent: 'purple',
          items: [
            { name: 'NestJS', icon: 'nestjs-plain' },
            { name: 'Node.js', icon: 'nodejs-plain' },
          ],
        })
        .expect(201)
    })

    it('la forma publica de un item solo lleva name e icon', async () => {
      const response = await http().get('/v1/skills?locale=es').expect(200)
      const category = (response.body as { items: Record<string, unknown>[] }[])[0]

      expect(Object.keys(category?.items[0] ?? {}).sort()).toEqual(['icon', 'name'])
    })

    it('la de admin si lleva los ids, que es lo que permite reordenar', async () => {
      const response = await http()
        .get('/v1/admin/skills/backend')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect((response.body as { items: { id: string }[] }).items[0]?.id).toHaveLength(36)
    })

    it('agrega un item al final', async () => {
      const response = await http()
        .post('/v1/admin/skills/backend/items')
        .set('Authorization', `Bearer ${editorToken}`)
        .send({ name: 'Fastify', icon: 'fastify-plain' })
        .expect(201)

      expect((response.body as { items: { name: string }[] }).items.map((i) => i.name)).toEqual([
        'NestJS',
        'Node.js',
        'Fastify',
      ])
    })

    it('rechaza un icono que el front no tiene vendorizado', async () => {
      // La FK contra icon_catalog es la que lo impide, en la base de datos.
      await http()
        .post('/v1/admin/skills/backend/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Inventado', icon: 'no-existe-plain' })
        .expect(500)
    })

    it('quitar un item exige rol admin', async () => {
      const category = await http()
        .get('/v1/admin/skills/backend')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      const itemId = (category.body as { items: { id: string }[] }).items[0]?.id ?? ''

      await http()
        .delete(`/v1/admin/skills/backend/items/${itemId}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .expect(403)

      await http()
        .delete(`/v1/admin/skills/backend/items/${itemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    })
  })

  describe('perfil', () => {
    it('sin perfil sembrado, la lectura publica es 404', async () => {
      const response = await http().get('/v1/profile').expect(404)

      expect(response.body).toMatchObject({ code: 'PROFILE_NOT_FOUND' })
    })

    it('no existe POST /v1/admin/profile: hay exactamente un perfil', async () => {
      await http()
        .post('/v1/admin/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404)
    })
  })

  describe('los chequeos de salud quedan fuera de /v1', () => {
    it('/health responde sin prefijo', async () => {
      await http().get('/health').expect(200)
    })

    it('/v1/health no existe', async () => {
      await http().get('/v1/health').expect(404)
    })
  })
})
