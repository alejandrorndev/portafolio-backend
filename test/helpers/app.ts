import { RequestMethod, ValidationPipe, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getOptionsToken } from '@nestjs/throttler'
import { User } from '@/domain/entities'
import { HASHER, USER_REPOSITORY, type IHasher, type IUserRepository } from '@/domain/ports'
import { AppModule } from '@/app.module'
import { DomainErrorFilter, HttpErrorFilter } from '@/interface/http/filters'

/*
 * -----------------------------------------------------------------------------
 * La aplicacion completa, configurada como en produccion.
 * -----------------------------------------------------------------------------
 * El prefijo, el ValidationPipe y los filtros se repiten aqui igual que en
 * `main.ts`. La alternativa —una funcion `configure(app)` compartida— seria menos
 * codigo, pero entonces un cambio en la configuracion de produccion se aplicaria
 * a los tests automaticamente y estos dejarian de poder detectarlo. Aqui los
 * tests declaran lo que ESPERAN de la configuracion.
 * -----------------------------------------------------------------------------
 */

/*
 * A que base se conecta: NO se decide aqui.
 *
 * Lo decide `databaseFor()` en `DatabaseModule`, mirando NODE_ENV —que Jest pone
 * en 'test'— y exigiendo que el nombre termine en `_test`. Este helper llego a
 * sobrescribir `process.env.DB_DATABASE_NAME` y no funciono: `@nestjs/config` lee
 * el archivo .env por su cuenta y el valor del archivo gana, asi que la suite
 * termino escribiendo en la base de desarrollo. La regla tiene que vivir donde se
 * elige la conexion, no donde se prepara el test.
 */

export interface TestAppOptions {
  /**
   * Intentos de login por minuto.
   *
   * Se sobrescribe el proveedor del limitador en vez de la variable de entorno, y
   * no por gusto: dentro del sandbox de Jest, `@nestjs/config` NO ve las
   * mutaciones de `process.env`. Solo lee el archivo .env, los valores por
   * defecto del esquema y lo que existiera en el entorno antes de arrancar Jest.
   * Por eso `NODE_ENV=test` si llega —lo pone Jest antes— y un
   * `process.env.LOGIN_RATE_LIMIT = '500'` escrito en un test no llega a ninguna
   * parte.
   */
  loginRateLimit?: number
}

export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] })

  if (options.loginRateLimit !== undefined) {
    builder
      .overrideProvider(getOptionsToken())
      .useValue([{ name: 'login', ttl: 60_000, limit: options.loginRateLimit }])
  }

  const moduleRef = await builder.compile()
  const app = moduleRef.createNestApplication()

  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/db', method: RequestMethod.GET },
    ],
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  app.useGlobalFilters(new HttpErrorFilter(), new DomainErrorFilter())

  await app.init()

  return app
}

/**
 * Crea un usuario con una contraseña conocida.
 *
 * Los tests necesitan poder iniciar sesion de verdad —pasando por bcrypt y por el
 * endpoint— y el .env solo tiene el hash del admin de arranque, no su contraseña.
 */
export async function createUserWithPassword(
  app: INestApplication,
  input: { email: string; password: string; role: 'admin' | 'editor'; isActive?: boolean },
): Promise<User> {
  const hasher = app.get<IHasher>(HASHER)
  const users = app.get<IUserRepository>(USER_REPOSITORY)

  const user = User.create({
    email: input.email,
    passwordHash: await hasher.hash(input.password),
    role: input.role,
    isActive: input.isActive ?? true,
  })

  await users.save(user)

  return user
}
