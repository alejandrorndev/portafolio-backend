import type { ExperienceItem, Profile, Project, SkillCategory } from '@/domain/entities'
import type { Accent, Locale } from '@/domain/value-objects'

/*
 * -----------------------------------------------------------------------------
 * Los presenters hacen lo que hoy hace `@/content` en el front.
 * -----------------------------------------------------------------------------
 * Misma entidad, dos representaciones:
 *
 *   · PUBLICA — texto ya resuelto a un idioma, con la forma EXACTA que exportan
 *     `getProfile(locale)`, `getProjects(locale)`, `getExperience(locale)` y
 *     `getSkillCategories(locale)`. Eso es lo que hace que conectar el front sea
 *     reescribir `src/content/index.ts` y nada mas.
 *
 *   · DE ADMIN — el objeto bilingue completo, que es lo que un editor necesita.
 *
 * Tres detalles no son casualidad, y `test/front-contract.e2e-spec.ts` los vigila:
 *
 *   1. La forma publica NO lleva `position`. En el front el orden es el del
 *      array, y aqui la respuesta ya viene ordenada.
 *   2. Los items de skills publicos NO llevan `id`: el front solo conoce
 *      `{ name, icon }`. Los ids salen en la forma de admin, que los necesita
 *      para reordenar y quitar.
 *   3. `cv` ausente es `undefined`, no `null`, porque el tipo del front dice
 *      `string | undefined` y la vista omite el boton comprobando eso.
 * -----------------------------------------------------------------------------
 */

export interface PublicProject {
  id: string
  type: string
  title: string
  description: string
  tags: string[]
  icon: string
  gradient: [string, string]
  links: { demo?: string; github?: string }
}

export interface PublicExperienceItem {
  id: string
  period: { start: string; end: string | null }
  company: string
  role: string
  description: string
  stack: string[]
  accent: Accent
  isCurrent: boolean
}

export interface PublicSkillCategory {
  id: string
  title: string
  accent: Accent
  items: { name: string; icon: string }[]
}

export interface PublicProfile {
  fullName: string
  displayName: { first: string; last: string }
  brand: string
  email: string
  location: string
  available: boolean
  headline: string
  role: string
  summary: string
  bio: string[]
  typewriterRoles: string[]
  socials: { id: string; label: string; href: string; icon: string | null }[]
  stats: { id: string; value: number; suffix: string; labelKey: string }[]
  cv: string | undefined
}

export const ContentPresenter = {
  project(project: Project, locale: Locale): PublicProject {
    return {
      id: project.id.value,
      type: project.type.get(locale),
      title: project.title.get(locale),
      description: project.description.get(locale),
      tags: [...project.tags],
      icon: project.icon,
      gradient: project.gradient.toJSON(),
      links: project.links.toJSON(),
    }
  },

  experienceItem(item: ExperienceItem, locale: Locale): PublicExperienceItem {
    return {
      id: item.id.value,
      period: item.period.toJSON(),
      company: item.company,
      role: item.role.get(locale),
      description: item.description.get(locale),
      stack: [...item.stack],
      accent: item.accent,
      // Derivado, igual que en el front: no es una columna.
      isCurrent: item.isCurrent,
    }
  },

  skillCategory(category: SkillCategory, locale: Locale): PublicSkillCategory {
    return {
      id: category.id.value,
      title: category.title.get(locale),
      accent: category.accent,
      items: category.items.map((item) => ({ name: item.name, icon: item.icon })),
    }
  },

  profile(profile: Profile, locale: Locale): PublicProfile {
    return {
      fullName: profile.fullName,
      displayName: { ...profile.displayName },
      brand: profile.brand,
      email: profile.email.value,
      location: profile.location.get(locale),
      available: profile.available,
      headline: profile.headline.get(locale),
      role: profile.role.get(locale),
      summary: profile.summary.get(locale),
      bio: profile.bio.map((paragraph) => paragraph.get(locale)),
      typewriterRoles: profile.typewriterRoles.map((role) => role.get(locale)),
      socials: profile.socials.map((social) => ({
        id: social.id.value,
        label: social.label,
        href: social.href,
        icon: social.icon,
      })),
      stats: profile.stats.map((stat) => ({
        id: stat.id.value,
        value: stat.value,
        suffix: stat.suffix,
        labelKey: stat.labelKey,
      })),
      // `undefined` y no `null`: el tipo del front es `string | undefined`.
      cv: profile.cv === null ? undefined : profile.cv.get(locale),
    }
  },
}

/*
 * La forma de admin es la de los primitivos del dominio, sin traducir.
 *
 * No hay una funcion por entidad porque no hay nada que decidir: `toPrimitives()`
 * ya es exactamente lo que un editor necesita. Los alias existen para que los
 * controllers no llamen a `toPrimitives()` directamente y el dia que haya algo
 * que ocultar —una fecha interna, un contador— haya un solo sitio donde hacerlo.
 */
export const AdminPresenter = {
  project: (project: Project) => project.toPrimitives(),
  experienceItem: (item: ExperienceItem) => item.toPrimitives(),
  skillCategory: (category: SkillCategory) => category.toPrimitives(),
  profile: (profile: Profile) => profile.toPrimitives(),
}
