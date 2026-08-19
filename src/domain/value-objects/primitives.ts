import { InvalidContentError } from '@/domain/errors'

/*
 * Validaciones sueltas que todas las entidades necesitan.
 *
 * No son value objects: envolver un nombre de empresa en una clase `Company` no
 * compra ninguna garantia que `parseText` no de ya, y llena el dominio de
 * ceremonia. Aqui viven las comprobaciones, en un solo lugar, para que el
 * mensaje de error sea consistente.
 */

/** Texto obligatorio, recortado. */
export function parseText(input: unknown, field: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    throw new InvalidContentError(`${field}: se esperaba texto`)
  }

  const trimmed = input.trim()

  if (trimmed.length === 0) {
    throw new InvalidContentError(`${field}: es obligatorio`)
  }

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new InvalidContentError(`${field}: supera los ${maxLength} caracteres`)
  }

  return trimmed
}

/** Texto opcional: null, undefined y '' colapsan a null. */
export function parseOptionalText(input: unknown, field: string): string | null {
  if (input === null || input === undefined || input === '') return null

  return parseText(input, field)
}

/** Lista de textos con un minimo de elementos. */
export function parseTextList(input: unknown, field: string, minItems = 1): string[] {
  if (!Array.isArray(input)) {
    throw new InvalidContentError(`${field}: se esperaba una lista`)
  }

  if (input.length < minItems) {
    throw new InvalidContentError(`${field}: necesita al menos ${minItems} elemento(s)`)
  }

  return input.map((item, index) => parseText(item, `${field}[${index}]`))
}

/** Lista de cualquier cosa, solo comprobando que es una lista con un minimo. */
export function parseList(input: unknown, field: string, minItems = 1): unknown[] {
  if (!Array.isArray(input)) {
    throw new InvalidContentError(`${field}: se esperaba una lista`)
  }

  if (input.length < minItems) {
    throw new InvalidContentError(`${field}: necesita al menos ${minItems} elemento(s)`)
  }

  return input
}

export function parseBoolean(input: unknown, field: string): boolean {
  if (typeof input !== 'boolean') {
    throw new InvalidContentError(`${field}: se esperaba true o false`)
  }

  return input
}

/** Entero no negativo. Se usa para `position` y para los contadores del perfil. */
export function parseNonNegativeInteger(input: unknown, field: string): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < 0) {
    throw new InvalidContentError(`${field}: se esperaba un entero no negativo`)
  }

  return input
}
