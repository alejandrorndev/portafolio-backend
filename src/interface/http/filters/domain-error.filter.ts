import { Catch, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
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

/*
 * -----------------------------------------------------------------------------
 * De error de dominio a respuesta HTTP, en un solo sitio.
 * -----------------------------------------------------------------------------
 * Los casos de uso no conocen codigos de estado: lanzan errores con significado.
 * Este filtro es el unico lugar donde ese significado se traduce a HTTP, asi que
 * agregar un error nuevo es agregar una linea aqui, y no un try/catch en cada
 * controller.
 *
 * La distincion entre 400 y 422 es la del §6.2 del diseño: 400 es "tu peticion
 * esta mal formada" —lo produce el ValidationPipe antes de llegar al dominio— y
 * 422 es "tu peticion es valida pero el dominio no la acepta". Un consumidor
 * puede distinguir entre corregir la forma y corregir el significado.
 * -----------------------------------------------------------------------------
 */
/*
 * Se indexa por NOMBRE de la clase y no por el constructor: un `Map<Function, ...>`
 * acepta cualquier cosa invocable y el linter lo señala con razon. El nombre lo
 * pone `DomainError` en el constructor, asi que no puede desincronizarse de la
 * clase.
 */
const STATUS_BY_ERROR = new Map<string, HttpStatus>([
  [NotFoundError.name, HttpStatus.NOT_FOUND],
  [DuplicateSlugError.name, HttpStatus.CONFLICT],
  [EmailAlreadyUsedError.name, HttpStatus.CONFLICT],
  [LastAdminError.name, HttpStatus.CONFLICT],
  [UnauthorizedError.name, HttpStatus.UNAUTHORIZED],
  [ForbiddenActionError.name, HttpStatus.FORBIDDEN],
  [InvalidContentError.name, HttpStatus.UNPROCESSABLE_ENTITY],
])

export interface ErrorBody {
  statusCode: number
  code: string
  message: string
}

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainErrorFilter.name)

  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()
    const status = STATUS_BY_ERROR.get(error.name) ?? HttpStatus.UNPROCESSABLE_ENTITY

    /*
     * Un error de dominio que no este en el mapa cae en 422 y se registra como
     * aviso. Es mejor que un 500: el dominio ya dijo que la peticion no procede,
     * y lo que falta es la traduccion, no la regla.
     */
    if (!STATUS_BY_ERROR.has(error.name)) {
      this.logger.warn(`Error de dominio sin traduccion HTTP: ${error.name}`)
    }

    const body: ErrorBody = {
      statusCode: status,
      // `code` es estable: el panel puede reaccionar a PROJECT_NOT_FOUND sin
      // parsear mensajes en español.
      code: error.code,
      message: error.message,
    }

    response.status(status).json(body)
  }
}
