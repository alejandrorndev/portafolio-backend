import { DomainError } from './domain.error'

/**
 * Un dato valido en forma pero inaceptable para el dominio.
 *
 * Es el error del `Localized` incompleto, del slug que no es kebab-case y del
 * proyecto sin ningun enlace. Se traduce a 422 y no a 400 a proposito: 400 es
 * "tu peticion esta mal formada" —eso lo detecta el DTO antes de llegar aqui— y
 * 422 es "tu peticion es valida pero el dominio no la acepta".
 */
export class InvalidContentError extends DomainError {
  readonly code = 'INVALID_CONTENT'

  constructor(message: string) {
    super(message)
  }
}
