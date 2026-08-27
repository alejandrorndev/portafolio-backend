import type { Server } from 'node:http'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, createUserWithPassword } from './helpers/app'
import { createTestDataSource, ensureTestDatabase, resetSchema } from './helpers/database'

/*
 * -----------------------------------------------------------------------------
 * El limite de intentos de login.
 * -----------------------------------------------------------------------------
 * En un archivo propio porque el contador del limitador vive en memoria y es
 * compartido por toda la aplicacion: si esta comprobacion estuviera junto al
 * resto de los tests HTTP, los logins de esos tests gastarian los intentos y
 * este dejaria de medir nada.
 *
 * Cada archivo de Jest tiene su propio registro de modulos, asi que aqui hay una
 * aplicacion nueva con un contador limpio y un limite de dos, puesto sobrescribiendo
 * el proveedor del limitador (dentro de Jest, `@nestjs/config` no ve las
 * mutaciones de `process.env`).
 * -----------------------------------------------------------------------------
 */

const USER = {
  email: 'throttle@test.local',
  password: 'contrasena-de-prueba',
  role: 'admin',
} as const

describe('limite de intentos de login', () => {
  let app: INestApplication

  // `getHttpServer()` devuelve `any`, y supertest lo recibiria sin tipo. La
  // asercion mantiene el tipado en todas las peticiones del archivo.
  const http = () => request(app.getHttpServer() as Server)
  const attempt = (password: string) =>
    http().post('/v1/auth/login').send({ email: USER.email, password })

  beforeAll(async () => {
    await ensureTestDatabase()

    const dataSource = createTestDataSource()
    await dataSource.initialize()
    await resetSchema(dataSource)
    await dataSource.destroy()

    app = await createTestApp({ loginRateLimit: 2 })
    await createUserWithPassword(app, USER)
  }, 120_000)

  afterAll(async () => {
    await app.close()
  })

  it('corta al superar el limite, y cuenta tambien los intentos fallidos', async () => {
    // Un limitador que solo contara los logins correctos no serviria para nada:
    // lo que hay que frenar es a quien prueba contrasenas.
    await attempt('equivocada').expect(401)
    await attempt('equivocada').expect(401)

    const response = await attempt(USER.password).expect(429)

    expect(response.body).toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
    })
  })

  it('no afecta a la lectura publica', async () => {
    // El limitador es nombrado y solo lo pide la ruta de login. Global dejaria el
    // portafolio en cinco visitas por minuto.
    await http().get('/v1/projects').expect(200)
    await http().get('/v1/projects').expect(200)
    await http().get('/v1/projects').expect(200)
  })
})
