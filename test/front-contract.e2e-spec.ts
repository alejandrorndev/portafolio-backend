import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Server } from 'node:http'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import type { DataSource } from 'typeorm'
import {
  CreateExperienceUseCase,
  CreateProfileUseCase,
  CreateProjectUseCase,
  CreateSkillCategoryUseCase,
  UpdateProfileUseCase,
} from '@/application/content/use-cases'
import { createTestApp } from './helpers/app'
import {
  createTestDataSource,
  ensureTestDatabase,
  resetSchema,
  seedIcons,
} from './helpers/database'

/*
 * -----------------------------------------------------------------------------
 * El contrato con el front.
 * -----------------------------------------------------------------------------
 * Este es el test que hace posible la Fase 5 —conectar el front a la API— y el
 * unico que la protege. El front consume `getProfile(locale)`,
 * `getProjects(locale)`, `getExperience(locale)` y `getSkillCategories(locale)`
 * desde `@/content`, y el dia que se conecte, esas funciones haran un fetch a
 * estos endpoints. Si las formas divergen, el sitio se rompe.
 *
 * Sin un test explicito, la divergencia no se descubre al introducirla: se
 * descubre el dia de la conexion, con el front ya modificado y sin saber cual de
 * los dos lados cambio.
 *
 * Se comparan las CLAVES y los tipos, no los valores: los valores son contenido y
 * cambian cuando Alejandro edita su portafolio. Lo que no puede cambiar sin
 * decidirlo es la forma.
 * -----------------------------------------------------------------------------
 */

const SEED = join(__dirname, '../src/infrastructure/database/seed/data')

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(join(SEED, `${file}.json`), 'utf8')) as T

/** Las formas que exporta `@/content` del front, copiadas del tipo real. */
const FRONT_SHAPES = {
  project: ['id', 'type', 'title', 'description', 'tags', 'icon', 'gradient', 'links'],
  experienceItem: [
    'id',
    'period',
    'company',
    'role',
    'description',
    'stack',
    'accent',
    'isCurrent',
  ],
  skillCategory: ['id', 'title', 'accent', 'items'],
  skillItem: ['name', 'icon'],
  profile: [
    'fullName',
    'displayName',
    'brand',
    'email',
    'location',
    'available',
    'headline',
    'role',
    'summary',
    'bio',
    'typewriterRoles',
    'socials',
    'stats',
  ],
  /*
   * `cv` va aparte porque es OPCIONAL en el front (`string | undefined`), y en
   * JSON un `undefined` se serializa omitiendo la clave. Cuando no hay CV la
   * respuesta no la trae, y eso es correcto: `profile.cv` sigue dando `undefined`
   * en el front, que es lo que la vista comprueba para omitir el boton de
   * descarga.
   */
  socialLink: ['id', 'label', 'href', 'icon'],
  stat: ['id', 'value', 'suffix', 'labelKey'],
} as const

const keysOf = (value: unknown): string[] => Object.keys(value as Record<string, unknown>).sort()
const expected = (shape: readonly string[]): string[] => [...shape].sort()

describe('contrato con el front', () => {
  let app: INestApplication
  let dataSource: DataSource

  // `getHttpServer()` devuelve `any`, y supertest lo recibiria sin tipo. La
  // asercion mantiene el tipado en todas las peticiones del archivo.
  const http = () => request(app.getHttpServer() as Server)

  beforeAll(async () => {
    await ensureTestDatabase()

    dataSource = createTestDataSource()
    await dataSource.initialize()
    await resetSchema(dataSource)
    await seedIcons(dataSource, read<string[]>('icons'))
    await dataSource.destroy()

    app = await createTestApp()

    /*
     * Se siembra el contenido REAL del portafolio, el mismo JSON que usa
     * `pnpm seed`. Asi el contrato se comprueba contra los datos que de verdad va
     * a servir la API, no contra un ejemplo inventado que podria no tener un `cv`
     * nulo, ni un periodo en curso, ni un icono nulo en una red social.
     */
    await app.get(CreateProfileUseCase).execute(read('profile'))

    for (const project of read<{ id: string }[]>('projects')) {
      await app.get(CreateProjectUseCase).execute(project as never)
    }

    for (const item of read<{ id: string }[]>('experience')) {
      await app.get(CreateExperienceUseCase).execute(item as never)
    }

    for (const category of read<{ id: string }[]>('skills')) {
      await app.get(CreateSkillCategoryUseCase).execute(category as never)
    }
  }, 180_000)

  afterAll(async () => {
    await app.close()
  })

  describe('GET /v1/projects', () => {
    it('devuelve exactamente las claves de ResolvedProject', async () => {
      const response = await http().get('/v1/projects?locale=es').expect(200)
      const projects = response.body as Record<string, unknown>[]

      expect(projects).toHaveLength(6)

      for (const project of projects) {
        expect(keysOf(project)).toEqual(expected(FRONT_SHAPES.project))
      }
    })

    it('el texto viene resuelto a un idioma, no como objeto bilingue', async () => {
      const response = await http().get('/v1/projects?locale=en').expect(200)
      const project = (response.body as Record<string, unknown>[])[0] ?? {}

      for (const field of ['type', 'title', 'description']) {
        expect(typeof project[field]).toBe('string')
      }
    })

    it('gradient es una tupla de dos hexadecimales', async () => {
      const response = await http().get('/v1/projects').expect(200)
      const gradient = (response.body as { gradient: string[] }[])[0]?.gradient ?? []

      expect(gradient).toHaveLength(2)
      expect(gradient[0]).toMatch(/^#[0-9a-f]{6}$/)
    })

    it('links omite las claves ausentes en vez de devolver null', async () => {
      // El tipo del front es `{ demo?: string; github?: string }`, y la vista
      // comprueba la existencia de la clave.
      const response = await http().get('/v1/projects').expect(200)
      const projects = response.body as { links: Record<string, unknown> }[]

      for (const project of projects) {
        for (const value of Object.values(project.links)) {
          expect(value).not.toBeNull()
        }

        expect(Object.keys(project.links).length).toBeGreaterThan(0)
      }
    })
  })

  describe('GET /v1/experience', () => {
    it('devuelve exactamente las claves de ResolvedExperienceItem', async () => {
      const response = await http().get('/v1/experience?locale=es').expect(200)
      const items = response.body as Record<string, unknown>[]

      expect(items).toHaveLength(4)

      for (const item of items) {
        expect(keysOf(item)).toEqual(expected(FRONT_SHAPES.experienceItem))
      }
    })

    it('isCurrent viene derivado, y el periodo en curso trae end nulo', async () => {
      const response = await http().get('/v1/experience').expect(200)
      const items = response.body as { isCurrent: boolean; period: { end: string | null } }[]
      const current = items.filter((item) => item.isCurrent)

      expect(current.length).toBeGreaterThan(0)

      for (const item of current) {
        expect(item.period.end).toBeNull()
      }
    })
  })

  describe('GET /v1/skills', () => {
    it('devuelve exactamente las claves de ResolvedSkillCategory', async () => {
      const response = await http().get('/v1/skills?locale=es').expect(200)
      const categories = response.body as Record<string, unknown>[]

      expect(categories).toHaveLength(4)

      for (const category of categories) {
        expect(keysOf(category)).toEqual(expected(FRONT_SHAPES.skillCategory))
      }
    })

    it('cada item lleva SOLO name e icon: el front no conoce ids ni posiciones', async () => {
      const response = await http().get('/v1/skills').expect(200)
      const categories = response.body as { items: Record<string, unknown>[] }[]
      const items = categories.flatMap((category) => category.items)

      expect(items).toHaveLength(28)

      for (const item of items) {
        expect(keysOf(item)).toEqual(expected(FRONT_SHAPES.skillItem))
      }
    })
  })

  describe('GET /v1/profile', () => {
    it('devuelve exactamente las claves de ResolvedProfile', async () => {
      const response = await http().get('/v1/profile?locale=es').expect(200)

      // Sin CV configurado, `cv` no viaja: ver la nota junto a FRONT_SHAPES.
      expect(keysOf(response.body)).toEqual(expected(FRONT_SHAPES.profile))
    })

    it('con un CV configurado, la clave aparece resuelta al idioma', async () => {
      await app.get(UpdateProfileUseCase).execute({
        cv: { es: '/cv/alejandro-restrepo-es.pdf', en: '/cv/alejandro-restrepo-en.pdf' },
      })

      try {
        const response = await http().get('/v1/profile?locale=en').expect(200)
        const body = response.body as Record<string, unknown>

        expect(keysOf(body)).toEqual(expected([...FRONT_SHAPES.profile, 'cv']))
        expect(body['cv']).toBe('/cv/alejandro-restrepo-en.pdf')
      } finally {
        // Se deja como estaba: los demas tests de este archivo comprueban el
        // estado sin CV, que es el real del portafolio hoy.
        await app.get(UpdateProfileUseCase).execute({ cv: null })
      }
    })

    it('bio y typewriterRoles son listas de texto ya resuelto', async () => {
      const response = await http().get('/v1/profile?locale=en').expect(200)
      const profile = response.body as { bio: unknown[]; typewriterRoles: unknown[] }

      expect(profile.bio.length).toBeGreaterThan(0)
      expect(profile.bio.every((paragraph) => typeof paragraph === 'string')).toBe(true)
      expect(profile.typewriterRoles.every((role) => typeof role === 'string')).toBe(true)
    })

    it('socials y stats tienen las claves que el front espera', async () => {
      const response = await http().get('/v1/profile').expect(200)
      const profile = response.body as {
        socials: Record<string, unknown>[]
        stats: Record<string, unknown>[]
      }

      for (const social of profile.socials) {
        expect(keysOf(social)).toEqual(expected(FRONT_SHAPES.socialLink))
      }

      for (const stat of profile.stats) {
        expect(keysOf(stat)).toEqual(expected(FRONT_SHAPES.stat))
      }
    })

    it('un social sin icono trae null, que es lo que el tipo del front admite', async () => {
      const response = await http().get('/v1/profile').expect(200)
      const socials = (response.body as { socials: { icon: string | null }[] }).socials

      for (const social of socials) {
        expect(social.icon === null || typeof social.icon === 'string').toBe(true)
      }
    })

    it('cv ausente viaja como undefined y NO como null', async () => {
      /*
       * El tipo del front es `string | undefined` y la vista omite el boton de
       * descarga comprobando eso. Un `null` en el JSON llegaria como `null`, que es
       * un valor distinto de `undefined`: la comprobacion del front cambiaria de
       * significado y aparecerian botones que llevan a un 404.
       *
       * En JSON, `undefined` se serializa OMITIENDO la clave, asi que lo que se
       * comprueba es que la clave no venga con null dentro.
       */
      const response = await http().get('/v1/profile').expect(200)
      const body = response.body as Record<string, unknown>

      expect(body['cv']).not.toBeNull()
      expect(body['cv']).toBeUndefined()
    })
  })

  describe('el idioma', () => {
    it('el mismo contenido en los dos idiomas tiene la misma forma', async () => {
      const [es, en] = await Promise.all([
        http().get('/v1/profile?locale=es').expect(200),
        http().get('/v1/profile?locale=en').expect(200),
      ])

      expect(keysOf(es.body)).toEqual(keysOf(en.body))
    })

    it('y devuelve textos distintos, o la resolucion de idioma no esta funcionando', async () => {
      const [es, en] = await Promise.all([
        http().get('/v1/projects?locale=es').expect(200),
        http().get('/v1/projects?locale=en').expect(200),
      ])

      const titleEs = (es.body as { title: string }[])[0]?.title
      const titleEn = (en.body as { title: string }[])[0]?.title

      expect(titleEs).not.toBe(titleEn)
    })
  })
})
