import type { ExperienceItem, Profile, Project, SkillCategory } from '@/domain/entities'

/*
 * -----------------------------------------------------------------------------
 * Puertos de persistencia del contenido.
 * -----------------------------------------------------------------------------
 * Son interfaces, no clases: el dominio declara QUE necesita y la
 * infraestructura decide COMO. Por eso los casos de uso se prueban con objetos
 * de mentira y sin levantar Postgres.
 *
 * Ningun metodo devuelve filas, DTOs ni tipos de TypeORM: entran y salen
 * entidades de dominio ya validadas.
 * -----------------------------------------------------------------------------
 */

/** Operaciones comunes a las tres colecciones ordenables. */
export interface IOrderedRepository<T> {
  /** Todas, ordenadas por `position`. */
  findAll(): Promise<T[]>

  findById(id: string): Promise<T | null>

  /** Inserta o actualiza. El id lo trae la entidad. */
  save(entity: T): Promise<void>

  delete(id: string): Promise<void>

  /**
   * Guarda varias EN UNA TRANSACCION.
   *
   * Existe por el reordenamiento: seis `save` sueltos dejarian estados
   * intermedios con dos elementos en la misma posicion si algo falla a mitad.
   */
  saveAll(entities: readonly T[]): Promise<void>
}

/*
 * Alias y no `interface X extends Y {}`: una interfaz vacia que solo hereda es
 * identica a su supertipo, y nombrarla asi no agrega nada que el alias no diga.
 */
export type IProjectRepository = IOrderedRepository<Project>
export type IExperienceRepository = IOrderedRepository<ExperienceItem>
export type ISkillCategoryRepository = IOrderedRepository<SkillCategory>

/** El perfil es unico: no hay lista ni id que pasar. */
export interface IProfileRepository {
  get(): Promise<Profile | null>
  save(profile: Profile): Promise<void>
}

export const PROJECT_REPOSITORY = 'IProjectRepository'
export const EXPERIENCE_REPOSITORY = 'IExperienceRepository'
export const SKILL_CATEGORY_REPOSITORY = 'ISkillCategoryRepository'
export const PROFILE_REPOSITORY = 'IProfileRepository'
