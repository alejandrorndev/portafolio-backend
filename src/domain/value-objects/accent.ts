import { InvalidContentError } from '@/domain/errors'

/**
 * Color de acento de un elemento.
 *
 * En el HTML original esto se resolvia con `:nth-child(2) { color: cyan }`, asi
 * que reordenar un array desbarataba la paleta. Como dato, el color viaja con el
 * contenido y el orden deja de importar.
 *
 * La lista la define el sistema de diseño del front: es vocabulario visual, y
 * agregar un valor aqui sin agregarlo alla produce un elemento sin color.
 */
export const ACCENTS = ['purple', 'cyan', 'pink', 'gold'] as const

export type Accent = (typeof ACCENTS)[number]

export function isAccent(value: unknown): value is Accent {
  return typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)
}

export function parseAccent(input: unknown, field = 'accent'): Accent {
  if (!isAccent(input)) {
    throw new InvalidContentError(
      `${field}: "${String(input)}" no es un acento valido. Los validos son ${ACCENTS.join(', ')}`,
    )
  }

  return input
}
