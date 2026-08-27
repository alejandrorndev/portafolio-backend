import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DataSource } from 'typeorm'
import { AppModule } from '@/app.module'
import {
  CreateExperienceUseCase,
  CreateProfileUseCase,
  CreateProjectUseCase,
  CreateSkillCategoryUseCase,
  GetProfileUseCase,
  ListExperienceUseCase,
  ListProjectsUseCase,
  ListSkillCategoriesUseCase,
  type CreateExperienceInput,
  type CreateProjectInput,
  type CreateSkillCategoryInput,
} from '@/application/content/use-cases'
import type { ProfileInput } from '@/domain/entities'
import { DuplicateSlugError, NotFoundError } from '@/domain/errors'

/*
 * Los JSON se leen con el tipo de entrada de cada caso de uso, no con un
 * `{ id: string }` generico: esos tipos declaran sus campos como `unknown`, asi
 * que no se afirma nada sobre el contenido —lo valida el dominio— pero si queda
 * claro que este archivo alimenta ESE caso de uso y no otro.
 */
type SeedProject = CreateProjectInput & { id: string }
type SeedExperience = CreateExperienceInput & { id: string }
type SeedSkillCategory = CreateSkillCategoryInput & { id: string }

/*
 * -----------------------------------------------------------------------------
 * Carga el contenido inicial del portafolio.
 * -----------------------------------------------------------------------------
 * Dos decisiones que definen este archivo:
 *
 *   1. Los datos salen de JSON commiteado en `seed/data/`, generado con
 *      `pnpm import:front`. El seed NO lee el repositorio del front: un backend
 *      que no se puede sembrar si alguien movio la carpeta del front seria un
 *      acoplamiento absurdo entre dos proyectos que se despliegan por separado.
 *
 *   2. Se invoca a los CASOS DE USO, no a `INSERT`. Asi el contenido importado
 *      pasa por los mismos invariantes que el creado por API —los dos idiomas, el
 *      slug, el enlace obligatorio— y este script es la primera prueba de
 *      integracion real del dominio. Un `INSERT` directo se saltaria justo lo que
 *      hay que comprobar.
 *
 * Es idempotente: correrlo dos veces no duplica ni sobrescribe. Lo que ya existe
 * se deja como esta, porque el seed no puede deshacer una edicion hecha desde el
 * panel.
 *
 *   pnpm seed
 * -----------------------------------------------------------------------------
 */

const DATA = join(__dirname, 'data')

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(join(DATA, `${file}.json`), 'utf8')) as T

interface SeedSummary {
  icons: number
  profile: 'creado' | 'ya existia'
  projects: number
  experience: number
  skills: number
}

/**
 * Siembra el catalogo de iconos.
 *
 * Va por SQL y no por un caso de uso porque no es contenido del portafolio: es un
 * catalogo de referencia que existe para que la FK de `skill_items` pueda
 * rechazar un icono que el front no tiene vendorizado. No hay ninguna regla de
 * negocio que aplicarle.
 */
async function seedIcons(dataSource: DataSource, names: string[]): Promise<number> {
  const values = names.map((_, index) => `($${index + 1})`).join(', ')

  const result = await dataSource.query<unknown[]>(
    `INSERT INTO "icon_catalog" ("name") VALUES ${values} ON CONFLICT ("name") DO NOTHING RETURNING "name"`,
    names,
  )

  return result.length
}

async function main(): Promise<void> {
  const logger = new Logger('seed')
  /*
   * Sin `bufferLogs`: en un proceso que arranca, hace su trabajo y se cierra, los
   * logs bufferizados no llegan a vaciarse nunca y el seed corre en silencio —
   * que es lo que paso la primera vez que se ejecuto.
   */
  const app = await NestFactory.createApplicationContext(AppModule)

  try {
    const dataSource = app.get(DataSource)

    const summary: SeedSummary = {
      icons: await seedIcons(dataSource, read<string[]>('icons')),
      profile: 'ya existia',
      projects: 0,
      experience: 0,
      skills: 0,
    }

    /*
     * Se pregunta si existe ANTES de crear. `CreateProfileUseCase` es idempotente
     * y devuelve el perfil existente sin tocarlo, asi que por su respuesta no hay
     * forma de saber si lo creo o no.
     */
    const profileExisted = await app
      .get(GetProfileUseCase)
      .execute()
      .then(() => true)
      .catch((error: unknown) => {
        if (error instanceof NotFoundError) return false
        throw error
      })

    await app.get(CreateProfileUseCase).execute(read<ProfileInput>('profile'))
    summary.profile = profileExisted ? 'ya existia' : 'creado'

    summary.projects = await seedCollection(
      read<SeedProject[]>('projects'),
      await app.get(ListProjectsUseCase).execute(),
      (item) => app.get(CreateProjectUseCase).execute(item),
    )

    summary.experience = await seedCollection(
      read<SeedExperience[]>('experience'),
      await app.get(ListExperienceUseCase).execute(),
      (item) => app.get(CreateExperienceUseCase).execute(item),
    )

    summary.skills = await seedCollection(
      read<SeedSkillCategory[]>('skills'),
      await app.get(ListSkillCategoriesUseCase).execute(),
      (item) => app.get(CreateSkillCategoryUseCase).execute(item),
    )

    logger.log(
      `Listo. Iconos nuevos: ${summary.icons}. Perfil: ${summary.profile}. ` +
        `Proyectos nuevos: ${summary.projects}. Experiencias nuevas: ${summary.experience}. ` +
        `Categorias nuevas: ${summary.skills}.`,
    )
  } finally {
    await app.close()
  }
}

/**
 * Crea lo que falta y deja lo que ya esta.
 *
 * Se comprueba contra lo existente ANTES de intentar crear, en lugar de crear y
 * capturar el conflicto: el caso de uso asigna la posicion al final de la lista,
 * asi que un intento fallido no deja huecos ni desordena nada.
 */
async function seedCollection<T extends { id: string }>(
  items: T[],
  existing: { id: { value: string } }[],
  create: (item: T) => Promise<unknown>,
): Promise<number> {
  const present = new Set(existing.map((item) => item.id.value))
  let created = 0

  for (const item of items) {
    if (present.has(item.id)) continue

    try {
      await create(item)
      created += 1
    } catch (error) {
      // Una carrera con otro proceso es lo unico que puede traer esto aqui, y
      // significa que el elemento ya existe: exactamente lo que se queria.
      if (!(error instanceof DuplicateSlugError)) throw error
    }
  }

  return created
}

void main().catch((error: unknown) => {
  new Logger('seed').error('El seed fallo', error)
  process.exitCode = 1
})
