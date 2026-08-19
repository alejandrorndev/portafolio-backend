import { DomainError } from './domain.error'

/** Ese correo ya pertenece a otro usuario. */
export class EmailAlreadyUsedError extends DomainError {
  readonly code = 'EMAIL_ALREADY_USED'

  constructor(readonly email: string) {
    super(`El correo "${email}" ya esta registrado`)
  }
}
