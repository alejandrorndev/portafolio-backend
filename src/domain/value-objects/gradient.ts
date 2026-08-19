import { InvalidContentError } from '@/domain/errors'
import { HexColor } from './hex-color'

/**
 * Gradiente del preview de un proyecto: desde y hasta.
 *
 * Se guarda en dos columnas y no en un `jsonb` porque son dos colores con una
 * regla que Postgres puede verificar. Al consumidor se le devuelve como tupla,
 * que es la forma que el front ya conoce.
 */
export class Gradient {
  private constructor(
    readonly from: HexColor,
    readonly to: HexColor,
  ) {}

  static of(input: unknown, field = 'gradient'): Gradient {
    if (!Array.isArray(input) || input.length !== 2) {
      throw new InvalidContentError(`${field}: se esperaban exactamente dos colores [desde, hasta]`)
    }

    return new Gradient(HexColor.of(input[0], `${field}[0]`), HexColor.of(input[1], `${field}[1]`))
  }

  static fromColumns(from: unknown, to: unknown): Gradient {
    return new Gradient(HexColor.of(from, 'gradient_from'), HexColor.of(to, 'gradient_to'))
  }

  toJSON(): [string, string] {
    return [this.from.value, this.to.value]
  }
}
