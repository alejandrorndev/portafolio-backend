import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common'
import {
  DomainError,
  DuplicateSlugError,
  EmailAlreadyUsedError,
  ForbiddenActionError,
  InvalidContentError,
  LastAdminError,
  NotFoundError,
  UnauthorizedError,
} from '@/domain/errors'
import { DomainErrorFilter } from './domain-error.filter'
import { HttpErrorFilter } from './http-error.filter'

/*
 * Los filtros son el unico sitio donde un error se convierte en una respuesta, y
 * eso los vuelve el contrato de errores de toda la API. Se prueban con una
 * respuesta de mentira: lo que importa es el codigo y el cuerpo, no Express.
 */

interface Captured {
  status?: number
  body?: unknown
}

const hostWith = (captured: Captured): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => ({
        status(code: number) {
          captured.status = code
          return this
        },
        json(payload: unknown) {
          captured.body = payload
          return this
        },
      }),
    }),
  }) as unknown as ArgumentsHost

describe('DomainErrorFilter', () => {
  const capture = (error: DomainError): Captured => {
    const captured: Captured = {}
    new DomainErrorFilter().catch(error, hostWith(captured))

    return captured
  }

  it.each([
    ['NotFoundError', new NotFoundError('project', 'x'), 404, 'PROJECT_NOT_FOUND'],
    ['DuplicateSlugError', new DuplicateSlugError('project', 'x'), 409, 'DUPLICATE_ID'],
    ['EmailAlreadyUsedError', new EmailAlreadyUsedError('a@b.co'), 409, 'EMAIL_ALREADY_USED'],
    ['LastAdminError', new LastAdminError('borrarlo'), 409, 'LAST_ADMIN'],
    ['UnauthorizedError', new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    ['ForbiddenActionError', new ForbiddenActionError('borrar'), 403, 'FORBIDDEN_ACTION'],
    ['InvalidContentError', new InvalidContentError('mal'), 422, 'INVALID_CONTENT'],
  ])('%s se traduce a %i con el codigo %s', (_label, error, status, code) => {
    const captured = capture(error)

    expect(captured.status).toBe(status)
    expect(captured.body).toEqual({ statusCode: status, code, message: error.message })
  })

  it('un error de dominio sin traduccion cae en 422 y lo avisa', () => {
    // Mejor que un 500: el dominio ya dijo que la peticion no procede, y lo que
    // falta es la traduccion, no la regla.
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    class ErrorNuevoSinMapear extends DomainError {
      readonly code = 'ERROR_NUEVO'
    }

    const captured = capture(new ErrorNuevoSinMapear('algo'))

    expect(captured.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(captured.body).toMatchObject({ code: 'ERROR_NUEVO' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ErrorNuevoSinMapear'))
  })

  it('el cuerpo nunca lleva mas que statusCode, code y message', () => {
    expect(Object.keys(capture(new UnauthorizedError()).body as object).sort()).toEqual([
      'code',
      'message',
      'statusCode',
    ])
  })
})

describe('HttpErrorFilter', () => {
  const capture = (exception: HttpException): Captured => {
    const captured: Captured = {}
    new HttpErrorFilter().catch(exception, hostWith(captured))

    return captured
  }

  it('convierte la lista del ValidationPipe en details', () => {
    // Aplanar los problemas en un solo string obligaria al cliente a partirlo por
    // comas para saber que campo corregir.
    const captured = capture(
      new BadRequestException({
        message: ['id debe ser kebab-case', 'tags no puede estar vacio'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    )

    expect(captured.status).toBe(400)
    expect(captured.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'La peticion no paso la validacion',
      details: ['id debe ser kebab-case', 'tags no puede estar vacio'],
    })
  })

  it('una ruta inexistente responde con el mismo formato', () => {
    const captured = capture(new NotFoundException('Cannot GET /v1/nada'))

    expect(captured.body).toEqual({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: 'Cannot GET /v1/nada',
    })
  })

  it('un 429 del limitador trae su propio codigo', () => {
    const captured = capture(new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS))

    expect(captured.body).toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })

  it('un estado sin codigo asignado cae en HTTP_ERROR', () => {
    const captured = capture(new HttpException('Sin mapear', HttpStatus.I_AM_A_TEAPOT))

    expect(captured.body).toMatchObject({ statusCode: 418, code: 'HTTP_ERROR' })
  })

  it('acepta un payload que es solo texto', () => {
    const captured = capture(new HttpException('Texto suelto', HttpStatus.CONFLICT))

    expect(captured.body).toEqual({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Texto suelto',
    })
  })

  it('cae al mensaje de la excepcion cuando el payload no tiene uno', () => {
    const captured = capture(new HttpException({ algo: 'raro' }, HttpStatus.BAD_REQUEST))

    expect((captured.body as { message: string }).message.length).toBeGreaterThan(0)
    expect(captured.body).not.toHaveProperty('details')
  })

  it('no agrega details cuando no hay lista de problemas', () => {
    expect(capture(new NotFoundException('nada')).body).not.toHaveProperty('details')
  })
})
