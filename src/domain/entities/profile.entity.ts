import { Email } from '@/domain/value-objects/email'
import { Localized } from '@/domain/value-objects/localized'
import { parseBoolean, parseList, parseText } from '@/domain/value-objects/primitives'
import { SocialLink } from '@/domain/value-objects/social-link'
import { Stat } from '@/domain/value-objects/stat'

/**
 * El perfil es un agregado unico: hay exactamente uno.
 *
 * En la base de datos eso se garantiza con `CHECK (id = 'singleton')`, que es mas
 * simple que una tabla de configuracion clave-valor y hace imposible el estado de
 * "dos perfiles".
 */
export const PROFILE_ID = 'singleton'

export interface ProfileInput {
  fullName: unknown
  displayName: unknown
  brand: unknown
  email: unknown
  location: unknown
  available: unknown
  headline: unknown
  role: unknown
  summary: unknown
  bio: unknown
  typewriterRoles: unknown
  socials: unknown
  stats: unknown
  cv?: unknown
}

export interface ProfilePrimitives {
  id: string
  fullName: string
  displayName: { first: string; last: string }
  brand: string
  email: string
  location: Record<string, string>
  available: boolean
  headline: Record<string, string>
  role: Record<string, string>
  summary: Record<string, string>
  bio: Record<string, string>[]
  typewriterRoles: Record<string, string>[]
  socials: ReturnType<SocialLink['toJSON']>[]
  stats: ReturnType<Stat['toJSON']>[]
  cv: Record<string, string> | null
}

export class Profile {
  readonly id = PROFILE_ID

  private constructor(
    readonly fullName: string,
    readonly displayName: { first: string; last: string },
    readonly brand: string,
    readonly email: Email,
    readonly location: Localized<string>,
    readonly available: boolean,
    readonly headline: Localized<string>,
    readonly role: Localized<string>,
    readonly summary: Localized<string>,
    readonly bio: readonly Localized<string>[],
    readonly typewriterRoles: readonly Localized<string>[],
    readonly socials: readonly SocialLink[],
    readonly stats: readonly Stat[],
    /** `null` mientras no exista el PDF: la vista omite el boton de descarga. */
    readonly cv: Localized<string> | null,
  ) {}

  static create(input: ProfileInput): Profile {
    const displayName = (input.displayName ?? {}) as Record<string, unknown>

    return new Profile(
      parseText(input.fullName, 'profile.fullName'),
      {
        first: parseText(displayName['first'], 'profile.displayName.first'),
        last: parseText(displayName['last'], 'profile.displayName.last'),
      },
      parseText(input.brand, 'profile.brand'),
      Email.of(input.email, 'profile.email'),
      Localized.text(input.location, 'profile.location'),
      parseBoolean(input.available, 'profile.available'),
      Localized.text(input.headline, 'profile.headline'),
      Localized.text(input.role, 'profile.role'),
      Localized.text(input.summary, 'profile.summary'),
      parseList(input.bio, 'profile.bio').map((paragraph, index) =>
        Localized.text(paragraph, `profile.bio[${index}]`),
      ),
      parseList(input.typewriterRoles, 'profile.typewriterRoles').map((role, index) =>
        Localized.text(role, `profile.typewriterRoles[${index}]`),
      ),
      Profile.sorted(
        parseList(input.socials, 'profile.socials').map((social, index) =>
          SocialLink.of(social, `profile.socials[${index}]`),
        ),
      ),
      Profile.sorted(
        parseList(input.stats, 'profile.stats').map((stat, index) =>
          Stat.of(stat, `profile.stats[${index}]`),
        ),
      ),
      input.cv === null || input.cv === undefined ? null : Localized.text(input.cv, 'profile.cv'),
    )
  }

  patch(changes: Partial<ProfileInput>): Profile {
    const { id: _id, ...current } = this.toPrimitives()

    return Profile.create({ ...current, ...changes })
  }

  toPrimitives(): ProfilePrimitives {
    return {
      id: this.id,
      fullName: this.fullName,
      displayName: { ...this.displayName },
      brand: this.brand,
      email: this.email.value,
      location: this.location.toJSON(),
      available: this.available,
      headline: this.headline.toJSON(),
      role: this.role.toJSON(),
      summary: this.summary.toJSON(),
      bio: this.bio.map((paragraph) => paragraph.toJSON()),
      typewriterRoles: this.typewriterRoles.map((role) => role.toJSON()),
      socials: this.socials.map((social) => social.toJSON()),
      stats: this.stats.map((stat) => stat.toJSON()),
      cv: this.cv === null ? null : this.cv.toJSON(),
    }
  }

  private static sorted<T extends { position: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.position - b.position)
  }
}
