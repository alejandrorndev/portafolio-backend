import { DomainError } from './domain.error'

/**
 * El actor esta autenticado pero su rol no alcanza.
 *
 * Vive en el dominio, no en el guard, porque la regla "solo un admin borra" debe
 * cumplirse tambien cuando el caso de uso lo invoque un script, donde no hay
 * ningun guard que proteja nada.
 */
export class ForbiddenActionError extends DomainError {
  readonly code = 'FORBIDDEN_ACTION'

  constructor(action: string) {
    super(`El rol actual no permite ${action}`)
  }
}
