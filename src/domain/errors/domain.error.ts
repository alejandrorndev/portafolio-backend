/*
 * -----------------------------------------------------------------------------
 * Errores de dominio.
 * -----------------------------------------------------------------------------
 * El dominio nunca lanza excepciones HTTP. Un `NotFoundException` de Nest en un
 * caso de uso lo ata al transporte: el mismo codigo invocado desde el seed o
 * desde un script tendria que hablar de codigos de estado que ahi no significan
 * nada.
 *
 * En su lugar cada error trae un `code` estable. `DomainErrorFilter` (capa
 * interface) lo traduce a HTTP, y el panel de administracion puede reaccionar a
 * `PROJECT_NOT_FOUND` sin parsear mensajes en español.
 * -----------------------------------------------------------------------------
 */
export abstract class DomainError extends Error {
  /** Identificador estable para los consumidores de la API. */
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = new.target.name
    // Sin esto, `instanceof` falla al compilar a ES5/ES2015 en algunas cadenas
    // de herencia y el filtro de errores dejaria pasar el error como 500.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
