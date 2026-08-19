import { DomainError } from './domain.error'

/**
 * Credenciales invalidas, token invalido o usuario desactivado.
 *
 * El mensaje NO distingue entre "ese correo no existe" y "la contraseña esta
 * mal": decirlo convierte el login en un verificador de correos registrados.
 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED'

  constructor(message = 'Credenciales invalidas') {
    super(message)
  }
}
