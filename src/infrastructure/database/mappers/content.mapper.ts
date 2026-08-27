import type { DeepPartial } from 'typeorm'
import { ExperienceItem, Profile, Project, SkillCategory } from '@/domain/entities'
import type {
  ExperienceOrmEntity,
  ProfileOrmEntity,
  ProjectOrmEntity,
  SkillCategoryOrmEntity,
  SkillItemOrmEntity,
} from '@/infrastructure/database/orm'

/*
 * Las filas que los mappers LEEN, sin las columnas que gestiona la base de
 * datos.
 *
 * `created_at` y `updated_at` los pone Postgres y no participan en ninguna regla
 * de negocio, asi que pedirlos en la firma solo obligaria a inventar fechas en
 * cada test. Una entidad completa de TypeORM sigue encajando en estos tipos.
 */
type Timestamps = 'createdAt' | 'updatedAt'

export type ProjectRow = Omit<ProjectOrmEntity, Timestamps>
export type ExperienceRow = Omit<ExperienceOrmEntity, Timestamps>
export type ProfileRow = Omit<ProfileOrmEntity, Timestamps>
/** De un item solo se lee lo que el dominio necesita: ni la relacion ni la FK. */
export type SkillItemRow = Pick<SkillItemOrmEntity, 'id' | 'name' | 'icon' | 'position'>

export type SkillCategoryRow = Omit<SkillCategoryOrmEntity, Timestamps | 'items'> & {
  /*
   * Opcional y explicitamente `undefined`: si la consulta olvido pedir la
   * relacion, eso tiene que poder representarse para que `create` lo rechace en
   * vez de devolver una categoria vacia.
   */
  items?: SkillItemRow[] | undefined
}

/*
 * -----------------------------------------------------------------------------
 * Traduccion entre la fila de Postgres y la entidad de dominio.
 * -----------------------------------------------------------------------------
 * Es el precio de tener las dos entidades separadas, y el beneficio esta en el
 * otro lado: los casos de uso no saben que existe una base de datos.
 *
 * `toDomain` pasa por `create`, asi que una fila corrupta —un jsonb sin el
 * ingles, un gradiente invalido— falla al leerse con un error de dominio claro
 * en vez de propagarse hasta la respuesta HTTP.
 *
 * Cada mapper tiene un test de ida y vuelta. Es el que atrapa el campo que
 * alguien olvido agregar al agregar una columna.
 * -----------------------------------------------------------------------------
 */

export const ProjectMapper = {
  toDomain(row: ProjectRow): Project {
    return Project.create({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      tags: row.tags,
      icon: row.icon,
      // El gradiente vive en dos columnas para que Postgres pueda validarlas,
      // pero el dominio y el front lo tratan como tupla.
      gradient: [row.gradientFrom, row.gradientTo],
      links: { demo: row.linkDemo, github: row.linkGithub },
      position: row.position,
    })
  },

  toOrm(project: Project): DeepPartial<ProjectOrmEntity> {
    const primitives = project.toPrimitives()

    return {
      id: primitives.id,
      type: primitives.type,
      title: primitives.title,
      description: primitives.description,
      tags: primitives.tags,
      icon: primitives.icon,
      gradientFrom: primitives.gradient[0],
      gradientTo: primitives.gradient[1],
      // `undefined` en el dominio es "sin enlace"; en la columna eso es NULL.
      linkDemo: primitives.links.demo ?? null,
      linkGithub: primitives.links.github ?? null,
      position: primitives.position,
    }
  },
}

export const ExperienceMapper = {
  toDomain(row: ExperienceRow): ExperienceItem {
    return ExperienceItem.create({
      id: row.id,
      period: { start: row.periodStart, end: row.periodEnd },
      company: row.company,
      role: row.role,
      description: row.description,
      stack: row.stack,
      accent: row.accent,
      position: row.position,
    })
  },

  toOrm(item: ExperienceItem): DeepPartial<ExperienceOrmEntity> {
    const primitives = item.toPrimitives()

    return {
      id: primitives.id,
      periodStart: primitives.period.start,
      periodEnd: primitives.period.end,
      company: primitives.company,
      role: primitives.role,
      description: primitives.description,
      stack: primitives.stack,
      accent: primitives.accent,
      position: primitives.position,
    }
  },
}

export const SkillCategoryMapper = {
  toDomain(row: SkillCategoryRow): SkillCategory {
    return SkillCategory.create({
      id: row.id,
      title: row.title,
      accent: row.accent,
      // `items` puede llegar vacio si la consulta no pidio la relacion. Eso
      // seria un error de la consulta, no un dato valido, y `create` lo dice.
      items: (row.items ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        position: item.position,
      })),
      position: row.position,
    })
  },

  toOrm(category: SkillCategory): DeepPartial<SkillCategoryOrmEntity> {
    const primitives = category.toPrimitives()

    return {
      id: primitives.id,
      title: primitives.title,
      accent: primitives.accent,
      position: primitives.position,
    }
  },

  /** Los items se guardan aparte: son filas de su propia tabla. */
  itemsToOrm(category: SkillCategory): DeepPartial<SkillItemOrmEntity>[] {
    return category.items.map((item) => ({
      id: item.id,
      categoryId: category.id.value,
      name: item.name,
      icon: item.icon,
      position: item.position,
    }))
  },
}

export const ProfileMapper = {
  toDomain(row: ProfileRow): Profile {
    return Profile.create({
      fullName: row.fullName,
      displayName: row.displayName,
      brand: row.brand,
      email: row.email,
      location: row.location,
      available: row.available,
      headline: row.headline,
      role: row.role,
      summary: row.summary,
      bio: row.bio,
      typewriterRoles: row.typewriterRoles,
      socials: row.socials,
      stats: row.stats,
      cv: row.cv,
    })
  },

  toOrm(profile: Profile): DeepPartial<ProfileOrmEntity> {
    const primitives = profile.toPrimitives()

    return {
      id: primitives.id,
      fullName: primitives.fullName,
      displayName: primitives.displayName,
      brand: primitives.brand,
      email: primitives.email,
      location: primitives.location,
      available: primitives.available,
      headline: primitives.headline,
      role: primitives.role,
      summary: primitives.summary,
      bio: primitives.bio,
      typewriterRoles: primitives.typewriterRoles,
      socials: primitives.socials,
      stats: primitives.stats,
      cv: primitives.cv,
    }
  },
}
