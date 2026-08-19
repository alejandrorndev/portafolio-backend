import { validateEnv } from './env.schema'

describe('validateEnv', () => {
  const valid = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' }

  it('aplica los valores por defecto cuando solo se da lo obligatorio', () => {
    const env = validateEnv(valid)

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3001)
    expect(env.CORS_ORIGINS).toEqual([])
  })

  it('falla nombrando la variable que falta', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/)
  })

  it('atribuye a la raiz un problema que no pertenece a ningun campo', () => {
    // Zod reporta con `path` vacio cuando lo invalido es el objeto entero.
    // Sin el caso, el mensaje diria "  · : ..." y no se entenderia nada.
    expect(() => validateEnv(null as unknown as Record<string, unknown>)).toThrow(/\(raiz\)/)
  })

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
  })

  it('convierte PORT a numero', () => {
    expect(validateEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080)
  })

  it('rechaza un PORT que no es un entero positivo', () => {
    expect(() => validateEnv({ ...valid, PORT: '-1' })).toThrow(/PORT/)
  })

  it('parte CORS_ORIGINS en lista y descarta espacios y entradas vacias', () => {
    const env = validateEnv({
      ...valid,
      CORS_ORIGINS: 'http://localhost:3000, https://portafolio.dev ,,',
    })

    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://portafolio.dev'])
  })
})
