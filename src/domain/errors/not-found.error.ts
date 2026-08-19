import { DomainError } from './domain.error'

/**
 * Lo pedido no existe.
 *
 * El `code` se compone con el recurso (`PROJECT_NOT_FOUND`, `USER_NOT_FOUND`)
 * para que un cliente pueda distinguir sin leer el mensaje.
 */
export class NotFoundError extends DomainError {
  readonly code: string

  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`No existe ${resource} con id "${id}"`)
    this.code = `${resource.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_NOT_FOUND`
  }
}
