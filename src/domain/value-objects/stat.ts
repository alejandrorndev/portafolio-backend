import { parseNonNegativeInteger, parseText } from './primitives'
import { Slug } from './slug'

/**
 * Un contador de la seccion "Sobre mi": "+4 años", "15+ tecnologias".
 *
 * `labelKey` es una CLAVE de traduccion, no una etiqueta: el texto vive en los
 * mensajes de UI del front, que es quien sabe decir "años de experiencia" en dos
 * idiomas. Guardar aqui el texto traducido duplicaria la traduccion en dos
 * sistemas y garantizaria que se desincronicen.
 */
export class Stat {
  private constructor(
    readonly id: Slug,
    readonly value: number,
    readonly suffix: string,
    readonly labelKey: string,
    readonly position: number,
  ) {}

  static of(input: unknown, field = 'stat'): Stat {
    const source = (input ?? {}) as Record<string, unknown>
    const suffix = source['suffix']

    return new Stat(
      Slug.of(source['id'], `${field}.id`),
      parseNonNegativeInteger(source['value'], `${field}.value`),
      // El sufijo puede ser vacio a proposito: "4 empresas" no lleva "+".
      typeof suffix === 'string' ? suffix.trim() : '',
      parseText(source['labelKey'], `${field}.labelKey`),
      parseNonNegativeInteger(source['position'] ?? 0, `${field}.position`),
    )
  }

  toJSON(): { id: string; value: number; suffix: string; labelKey: string; position: number } {
    return {
      id: this.id.value,
      value: this.value,
      suffix: this.suffix,
      labelKey: this.labelKey,
      position: this.position,
    }
  }
}
