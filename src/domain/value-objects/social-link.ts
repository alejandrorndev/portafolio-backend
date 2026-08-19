import { parseNonNegativeInteger, parseOptionalText, parseText } from './primitives'
import { Slug } from './slug'

/**
 * Enlace a una red social del perfil.
 *
 * `href` no exige https, a diferencia de los enlaces de un proyecto: el perfil
 * incluye un `mailto:` para el correo directo, y forzar https ahi romperia el
 * unico enlace que el visitante puede usar sin salir de su cliente de correo.
 *
 * `icon` es opcional: `null` significa "sin icono", no "icono pendiente".
 */
export class SocialLink {
  private constructor(
    readonly id: Slug,
    readonly label: string,
    readonly href: string,
    readonly icon: string | null,
    readonly position: number,
  ) {}

  static of(input: unknown, field = 'social'): SocialLink {
    const source = (input ?? {}) as Record<string, unknown>

    return new SocialLink(
      Slug.of(source['id'], `${field}.id`),
      parseText(source['label'], `${field}.label`),
      parseText(source['href'], `${field}.href`),
      parseOptionalText(source['icon'], `${field}.icon`),
      parseNonNegativeInteger(source['position'] ?? 0, `${field}.position`),
    )
  }

  toJSON(): { id: string; label: string; href: string; icon: string | null; position: number } {
    return {
      id: this.id.value,
      label: this.label,
      href: this.href,
      icon: this.icon,
      position: this.position,
    }
  }
}
