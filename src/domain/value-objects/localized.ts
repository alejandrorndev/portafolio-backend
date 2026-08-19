import { InvalidContentError } from '@/domain/errors'
import { LOCALES, type Locale } from './locale'

/*
 * -----------------------------------------------------------------------------
 * Un valor que existe en TODOS los idiomas.
 * -----------------------------------------------------------------------------
 * Es la regla de negocio central de este sistema, y viene del error mas probable
 * de un sitio bilingue: agregar un proyecto en español y olvidar el ingles.
 *
 * El front lo resolvio con el tipo `Record<Locale, T>`, asi que omitir un idioma
 * no compila. Aqui el compilador ya no protege nada —los datos entran por HTTP y
 * salen de una base de datos, en runtime— asi que el invariante tiene que
 * comprobarse al construir. Un `Localized` que existe es un `Localized`
 * completo.
 * -----------------------------------------------------------------------------
 */
export class Localized<T> {
  private constructor(private readonly values: Readonly<Record<Locale, T>>) {}

  /**
   * Construye desde un valor desconocido, validando que cada idioma este.
   *
   * @param field Nombre del campo, solo para que el mensaje de error sea util:
   *              "falta el idioma en en title" se corrige; "dato invalido" no.
   */
  static of<T>(input: unknown, field = 'valor'): Localized<T> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new InvalidContentError(`${field}: se esperaba un objeto con un valor por idioma`)
    }

    const source = input as Record<string, unknown>
    const values = {} as Record<Locale, T>

    for (const locale of LOCALES) {
      const value = source[locale]

      if (value === undefined || value === null) {
        throw new InvalidContentError(`${field}: falta el idioma "${locale}"`)
      }

      values[locale] = value as T
    }

    return new Localized<T>(values)
  }

  /**
   * Igual que `of`, para texto: recorta y exige contenido en cada idioma.
   *
   * Un string vacio pasaria la comprobacion de presencia y produciria una
   * tarjeta con el titulo en blanco, que es peor que un error al guardar.
   */
  static text(input: unknown, field = 'texto'): Localized<string> {
    const localized = Localized.of<unknown>(input, field)
    const values = {} as Record<Locale, string>

    for (const locale of LOCALES) {
      const value = localized.get(locale)

      if (typeof value !== 'string') {
        throw new InvalidContentError(`${field}: el idioma "${locale}" no es texto`)
      }

      const trimmed = value.trim()

      if (trimmed.length === 0) {
        throw new InvalidContentError(`${field}: el idioma "${locale}" esta vacio`)
      }

      values[locale] = trimmed
    }

    return new Localized<string>(values)
  }

  /** Colapsa el valor al idioma pedido. Es lo que hace `t()` en el front. */
  get(locale: Locale): T {
    return this.values[locale]
  }

  /** Forma serializable, tal como se guarda en la columna `jsonb`. */
  toJSON(): Record<Locale, T> {
    return { ...this.values }
  }

  equals(other: Localized<T>): boolean {
    return LOCALES.every((locale) => this.values[locale] === other.values[locale])
  }
}
