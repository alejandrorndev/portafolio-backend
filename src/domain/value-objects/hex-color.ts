import { InvalidContentError } from '@/domain/errors'

/**
 * Color en hexadecimal de 6 digitos.
 *
 * Se normaliza a minusculas para que "#FFF000" y "#fff000" no se guarden como
 * dos valores distintos del mismo color.
 */
const PATTERN = /^#[0-9a-fA-F]{6}$/

export class HexColor {
  private constructor(readonly value: string) {}

  static of(input: unknown, field = 'color'): HexColor {
    if (typeof input !== 'string' || !PATTERN.test(input)) {
      throw new InvalidContentError(
        `${field}: "${String(input)}" debe ser un hexadecimal de 6 digitos (ej. "#7c3aed")`,
      )
    }

    return new HexColor(input.toLowerCase())
  }

  toString(): string {
    return this.value
  }

  equals(other: HexColor): boolean {
    return this.value === other.value
  }
}
