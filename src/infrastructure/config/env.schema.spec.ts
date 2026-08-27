import { validateEnv } from './env.schema'

describe('validateEnv', () => {
  const valid = {
    DB_HOST: 'localhost',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'admin',
    DB_DATABASE_NAME: 'portafolio',
    JWT_SECRET: 'a'.repeat(32),
  }

  it('aplica los valores por defecto cuando solo se da lo obligatorio', () => {
    const env = validateEnv(valid)

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3001)
    expect(env.DB_PORT).toBe(5432)
    expect(env.DB_DATABASE_NAME_TEST).toBe('portafolio_test')
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(28_800)
    expect(env.CORS_ORIGINS).toEqual([])
  })

  describe('autenticacion', () => {
    it('exige JWT_SECRET: no hay valor por defecto para un secreto', () => {
      const { JWT_SECRET: _omitido, ...sinSecreto } = valid

      expect(() => validateEnv(sinSecreto)).toThrow(/JWT_SECRET/)
    })

    it('rechaza un JWT_SECRET corto', () => {
      // Un secreto de ocho caracteres se rompe por fuerza bruta, y con el se
      // firman tokens de administrador.
      expect(() => validateEnv({ ...valid, JWT_SECRET: 'corto' })).toThrow(/al menos 32/)
    })

    it('la vigencia del token por defecto es una jornada de trabajo', () => {
      expect(validateEnv(valid).JWT_EXPIRES_IN_SECONDS).toBe(8 * 60 * 60)
    })

    it('las credenciales de arranque son opcionales', () => {
      // Sin ellas la lectura publica funciona igual; el aviso al arrancar es lo
      // que evita que la ausencia pase inadvertida.
      const env = validateEnv(valid)

      expect(env.ADMIN_EMAIL).toBeUndefined()
      expect(env.ADMIN_PASSWORD_HASH).toBeUndefined()
    })

    it('pero si se dan, ADMIN_EMAIL tiene que ser un correo', () => {
      expect(() => validateEnv({ ...valid, ADMIN_EMAIL: 'no-es-correo' })).toThrow(/ADMIN_EMAIL/)
    })

    it('acepta las credenciales de arranque completas', () => {
      const env = validateEnv({
        ...valid,
        ADMIN_EMAIL: 'admin@portafolio.local',
        ADMIN_PASSWORD_HASH: '$2b$12$hash',
      })

      expect(env.ADMIN_EMAIL).toBe('admin@portafolio.local')
      expect(env.ADMIN_PASSWORD_HASH).toBe('$2b$12$hash')
    })
  })

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE_NAME'])(
    'falla nombrando %s cuando falta',
    (variable) => {
      const incomplete = { ...valid }
      delete incomplete[variable as keyof typeof valid]

      expect(() => validateEnv(incomplete)).toThrow(new RegExp(variable))
    },
  )

  it('atribuye a la raiz un problema que no pertenece a ningun campo', () => {
    // Zod reporta con `path` vacio cuando lo invalido es el objeto entero.
    // Sin el caso, el mensaje diria "  · : ..." y no se entenderia nada.
    expect(() => validateEnv(null as unknown as Record<string, unknown>)).toThrow(/\(raiz\)/)
  })

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
  })

  it('convierte los puertos a numero', () => {
    const env = validateEnv({ ...valid, PORT: '8080', DB_PORT: '5440' })

    expect(env.PORT).toBe(8080)
    expect(env.DB_PORT).toBe(5440)
  })

  it.each(['PORT', 'DB_PORT'])('rechaza un %s que no es un entero positivo', (variable) => {
    expect(() => validateEnv({ ...valid, [variable]: '-1' })).toThrow(new RegExp(variable))
  })

  it('acepta una contraseña con caracteres que romperian una URL', () => {
    // Es la razon de usar variables separadas en vez de una cadena de conexion:
    // en una URL, esto habria que escaparlo, y olvidarlo produce un
    // "authentication failed" que no dice por que.
    expect(validateEnv({ ...valid, DB_PASSWORD: 'p@ss:w/rd?#' }).DB_PASSWORD).toBe('p@ss:w/rd?#')
  })

  it('parte CORS_ORIGINS en lista y descarta espacios y entradas vacias', () => {
    const env = validateEnv({
      ...valid,
      CORS_ORIGINS: 'http://localhost:3000, https://portafolio.dev ,,',
    })

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://portafolio.dev'])
  })
})
