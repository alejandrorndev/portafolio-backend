import { DomainError } from './domain.error'

/**
 * La operacion dejaria el sistema sin ningun administrador activo.
 *
 * Sin esta regla, un clic desafortunado —borrarse, degradarse o desactivarse—
 * deja el sistema sin nadie que pueda administrarlo, y la unica salida es un
 * UPDATE a mano en la base de datos.
 */
export class LastAdminError extends DomainError {
  readonly code = 'LAST_ADMIN'

  constructor(action: string) {
    super(`No se puede ${action}: es el ultimo administrador activo`)
  }
}
