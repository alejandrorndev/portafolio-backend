import { InvalidContentError } from '@/domain/errors'

/**
 * Periodo de una experiencia laboral.
 *
 * `start` y `end` son ETIQUETAS, no fechas: el front muestra "2024" o "Ene 2024"
 * segun lo que se escribio, y convertirlas a `date` obligaria a inventar un dia
 * y un mes que nadie proporciono, para despues volver a formatearlos.
 *
 * `end === null` significa "en curso". `isCurrent` se DERIVA de eso y no se
 * guarda: un booleano aparte es un booleano que puede desincronizarse.
 */
export class Period {
  private constructor(
    readonly start: string,
    readonly end: string | null,
  ) {}

  static of(input: unknown, field = 'period'): Period {
    if (typeof input !== 'object' || input === null) {
      throw new InvalidContentError(`${field}: se esperaba un objeto con start y end`)
    }

    const source = input as Record<string, unknown>
    const start = source['start']
    const end = source['end']

    if (typeof start !== 'string' || start.trim().length === 0) {
      throw new InvalidContentError(`${field}: start es obligatorio`)
    }

    if (end !== null && end !== undefined && (typeof end !== 'string' || end.trim().length === 0)) {
      throw new InvalidContentError(`${field}: end debe ser una etiqueta o null si sigue en curso`)
    }

    return new Period(start.trim(), typeof end === 'string' ? end.trim() : null)
  }

  /** Derivado de `end === null`, nunca almacenado. */
  get isCurrent(): boolean {
    return this.end === null
  }

  toJSON(): { start: string; end: string | null } {
    return { start: this.start, end: this.end }
  }
}
