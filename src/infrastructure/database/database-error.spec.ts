import { DuplicateSlugError, InvalidContentError } from '@/domain/errors'
import { translateDatabaseError, translatingErrors } from './database-error'

/*
 * Se construyen errores con la forma que pone el driver de Postgres, en vez de
 * provocarlos con una base de datos real: aqui lo que se prueba es la traduccion,
 * y los errores de verdad ya los provocan `test/schema-constraints.e2e-spec.ts` y
 * `test/http.e2e-spec.ts`.
 */
const driverError = (fields: { code: string; constraint?: string; column?: string }) =>
  Object.assign(new Error('error del driver'), { driverError: fields })

describe('translateDatabaseError', () => {
  it('una FK del catalogo de iconos explica QUE hacer, no que constraint fallo', () => {
    // "FK_skill_items_icon" no le dice nada a quien edita su portafolio.
    expect(() =>
      translateDatabaseError(driverError({ code: '23503', constraint: 'FK_skill_items_icon' })),
    ).toThrow(InvalidContentError)

    expect(() =>
      translateDatabaseError(driverError({ code: '23503', constraint: 'FK_skill_items_icon' })),
    ).toThrow(/icono no existe en el catalogo/)
  })

  it('una FK desconocida sigue siendo un error de contenido, con el constraint como pista', () => {
    expect(() =>
      translateDatabaseError(driverError({ code: '23503', constraint: 'FK_algo_nuevo' })),
    ).toThrow(/FK_algo_nuevo/)
  })

  it('un CHECK conocido se explica en castellano', () => {
    expect(() =>
      translateDatabaseError(driverError({ code: '23514', constraint: 'CHK_projects_one_link' })),
    ).toThrow(/al menos un enlace/)
  })

  it('un CHECK desconocido tambien es 422, nombrando la regla', () => {
    expect(() =>
      translateDatabaseError(driverError({ code: '23514', constraint: 'CHK_algo' })),
    ).toThrow(/CHK_algo/)
  })

  it('el correo duplicado se explica sin hablar de indices', () => {
    expect(() =>
      translateDatabaseError(driverError({ code: '23505', constraint: 'UQ_users_email_lower' })),
    ).toThrow(/correo ya esta registrado/)
  })

  it('otra unicidad se traduce a DuplicateSlugError', () => {
    expect(() =>
      translateDatabaseError(driverError({ code: '23505', constraint: 'UQ_projects_position' })),
    ).toThrow(DuplicateSlugError)
  })

  it('un NOT NULL nombra la columna que falta', () => {
    expect(() => translateDatabaseError(driverError({ code: '23502', column: 'company' }))).toThrow(
      /company/,
    )
  })

  it('un NOT NULL sin columna tambien se traduce', () => {
    expect(() => translateDatabaseError(driverError({ code: '23502' }))).toThrow(
      /campo obligatorio/,
    )
  })

  describe('lo que NO se traduce', () => {
    it('un fallo de conexion se propaga tal cual: eso SI es del servidor', () => {
      // Convertirlo en 4xx esconderia una caida de la base detras de "tu peticion
      // esta mal".
      const connectionError = driverError({ code: 'ECONNREFUSED' })

      expect(() => translateDatabaseError(connectionError)).toThrow(connectionError)
    })

    it('un error que no viene del driver se propaga tal cual', () => {
      const cualquiera = new Error('algo raro')

      expect(() => translateDatabaseError(cualquiera)).toThrow(cualquiera)
    })

    it('un valor que no es un error se propaga tal cual', () => {
      expect(() => translateDatabaseError('texto')).toThrow('texto')
    })
  })

  it('lee el codigo tambien cuando viene en la raiz y no en driverError', () => {
    // TypeORM lo anida en `driverError`, pero `dataSource.query` lo lanza plano.
    const plano = Object.assign(new Error('plano'), {
      code: '23503',
      constraint: 'FK_skill_items_category',
    })

    expect(() => translateDatabaseError(plano)).toThrow(/categoria de skills/)
  })
})

describe('translatingErrors', () => {
  it('devuelve el resultado cuando la operacion funciona', async () => {
    await expect(translatingErrors(() => Promise.resolve('ok'))).resolves.toBe('ok')
  })

  it('traduce el error cuando la operacion falla', async () => {
    await expect(
      translatingErrors(() =>
        Promise.reject(driverError({ code: '23503', constraint: 'FK_skill_items_icon' })),
      ),
    ).rejects.toThrow(InvalidContentError)
  })
})
