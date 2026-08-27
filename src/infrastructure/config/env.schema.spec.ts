import { validateEnv } from './env.schema'

describe('validateEnv', () => {
  const valid = {
    DB_HOST: 'localhost',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'admin',
    DB_DATABASE_NAME: 'portafolio',
  }

  it('aplica los valores por defecto cuando solo se da lo obligatorio', () => {
    const env = validateEnv(valid)

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3001)
    expect(env.DB_PORT).toBe(5432)
    expect(env.DB_DATABASE_NAME_TEST).toBe('portafolio_test')
    expect(env.CORS_ORIGINS).toEqual([])
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
