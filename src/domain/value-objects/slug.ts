import { InvalidContentError } from '@/domain/errors'

/**
 * Identificador elegido a mano, en kebab-case.
 *
 * Los ids no se generan: se usan como key de React y como ancla de URL en el
 * front, asi que "api-rest-eventos" tiene que seguir siendo "api-rest-eventos"
 * despues de una migracion. La expresion regular es la misma que valida el
 * contenido del front.
 */
const PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class Slug {
  private constructor(readonly value: string) {}

  static of(input: unknown, field = 'id'): Slug {
    if (typeof input !== 'string' || !PATTERN.test(input)) {
      throw new InvalidContentError(
        `${field}: "${String(input)}" debe ser kebab-case en minusculas (ej. "api-rest-eventos")`,
      )
    }

    return new Slug(input)
  }

  toString(): string {
    return this.value
  }

  equals(other: Slug): boolean {
    return this.value === other.value
  }
}
