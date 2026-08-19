import { DomainError } from './domain.error'

/** Ya existe un registro con ese id. Los ids son elegidos, no generados. */
export class DuplicateSlugError extends DomainError {
  readonly code = 'DUPLICATE_ID'

  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`Ya existe ${resource} con id "${id}"`)
  }
}
