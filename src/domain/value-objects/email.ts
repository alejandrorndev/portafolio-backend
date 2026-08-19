import { InvalidContentError } from '@/domain/errors'

/**
 * Correo de un usuario, normalizado a minusculas.
 *
 * La normalizacion no es cosmetica: sin ella, "Admin@correo.co" y
 * "admin@correo.co" serian dos cuentas distintas y el indice unico de la base de
 * datos no lo impediria.
 *
 * La expresion regular es deliberadamente simple. Validar direcciones segun el
 * RFC completo es un pozo sin fondo, y la unica comprobacion que de verdad
 * importa —que el correo llegue— no la hace ninguna regex.
 */
const PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class Email {
  private constructor(readonly value: string) {}

  static of(input: unknown, field = 'email'): Email {
    if (typeof input !== 'string') {
      throw new InvalidContentError(`${field}: se esperaba texto`)
    }

    const normalized = input.trim().toLowerCase()

    if (!PATTERN.test(normalized)) {
      throw new InvalidContentError(`${field}: "${input}" no parece un correo valido`)
    }

    return new Email(normalized)
  }

  toString(): string {
    return this.value
  }

  equals(other: Email): boolean {
    return this.value === other.value
  }
}
