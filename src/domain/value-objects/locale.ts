import { InvalidContentError } from '@/domain/errors'

/**
 * Fuente unica de verdad de los idiomas, igual que `src/i18n/config.ts` en el
 * front.
 *
 * Agregar un idioma es agregarlo a esta tupla: a partir de ahi el compilador
 * señala cada `Record<Locale, T>` que quedo incompleto en vez de dejar huecos
 * silenciosos.
 */
export const LOCALES = ['es', 'en'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** Valida un idioma que llega de afuera. */
export function parseLocale(value: unknown): Locale {
  if (!isLocale(value)) {
    throw new InvalidContentError(
      `Idioma no soportado: "${String(value)}". Los validos son ${LOCALES.join(', ')}`,
    )
  }

  return value
}
