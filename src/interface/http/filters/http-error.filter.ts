import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Response } from 'express'

/*
 * -----------------------------------------------------------------------------
 * Un solo formato de error para toda la API.
 * -----------------------------------------------------------------------------
 * `DomainErrorFilter` ya da `{ statusCode, code, message }` a los errores de
 * dominio. Pero los que NO vienen del dominio —el 400 del ValidationPipe, el 429
 * del limitador, el 404 de una ruta que no existe— traen el formato de Nest, que
 * es distinto: `{ message: [...], error, statusCode }`, sin `code`.
 *
 * Eso obligaria al panel de la Fase 2 a manejar dos formas de error segun de donde
 * venga el fallo. Este filtro las unifica y agrega `details` cuando hay una lista
 * de problemas concretos, que es justo lo que un formulario necesita para señalar
 * el campo equivocado.
 * -----------------------------------------------------------------------------
 */

const CODE_BY_STATUS = new Map<number, string>([
  [HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED'],
  [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
  [HttpStatus.FORBIDDEN, 'FORBIDDEN_ACTION'],
  [HttpStatus.NOT_FOUND, 'ROUTE_NOT_FOUND'],
  [HttpStatus.METHOD_NOT_ALLOWED, 'METHOD_NOT_ALLOWED'],
  [HttpStatus.CONFLICT, 'CONFLICT'],
  [HttpStatus.PAYLOAD_TOO_LARGE, 'PAYLOAD_TOO_LARGE'],
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE'],
  [HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS'],
  [HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE'],
])

export interface HttpErrorBody {
  statusCode: number
  code: string
  message: string
  details?: string[]
}

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const status = exception.getStatus()
    const payload = exception.getResponse()

    const body: HttpErrorBody = {
      statusCode: status,
      code: CODE_BY_STATUS.get(status) ?? 'HTTP_ERROR',
      ...describe(payload, exception.message),
    }

    response.status(status).json(body)
  }
}

/**
 * Saca un mensaje y, si los hay, la lista de problemas concretos.
 *
 * El ValidationPipe mete un array en `message`; ahi cada elemento es un campo mal
 * enviado, y aplanarlos en un solo string obligaria al cliente a partirlo por
 * comas para saber que corregir.
 */
function describe(payload: unknown, fallback: string): { message: string; details?: string[] } {
  if (typeof payload === 'string') return { message: payload }

  if (typeof payload !== 'object' || payload === null) return { message: fallback }

  const message = (payload as { message?: unknown }).message

  if (Array.isArray(message)) {
    return {
      message: 'La peticion no paso la validacion',
      details: message.map((problem) => String(problem)),
    }
  }

  return { message: typeof message === 'string' ? message : fallback }
}
