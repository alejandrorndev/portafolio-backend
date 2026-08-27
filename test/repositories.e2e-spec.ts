import type { DataSource } from 'typeorm'
import { ExperienceItem, Profile, Project, SkillCategory, User } from '@/domain/entities'
import {
  TypeOrmExperienceRepository,
  TypeOrmProfileRepository,
  TypeOrmProjectRepository,
  TypeOrmSkillCategoryRepository,
  TypeOrmUserRepository,
} from '@/infrastructure/database/repos'
import {
  createTestDataSource,
  ensureTestDatabase,
  resetSchema,
  seedIcons,
  truncateAll,
} from './helpers/database'

const project = (id: string, position: number): Project =>
  Project.create({
    id,
    type: { es: 'API REST', en: 'REST API' },
    title: { es: `Proyecto ${id}`, en: `Project ${id}` },
    description: { es: 'Descripcion', en: 'Description' },
    tags: ['NestJS'],
    icon: '🎟️',
    gradient: ['#7c3aed', '#06b6d4'],
    links: { github: `https://github.com/a/${id}` },
    position,
  })

const experience = (id: string, position: number): ExperienceItem =>
  ExperienceItem.create({
    id,
    period: { start: '2024', end: null },
    company: 'Homepower',
    role: { es: 'Backend', en: 'Backend' },
    description: { es: 'APIs', en: 'APIs' },
    stack: ['NestJS'],
    accent: 'purple',
    position,
  })

const profile = (): Profile =>
  Profile.create({
    fullName: 'Alejandro Restrepo',
    displayName: { first: 'Alejandro', last: 'Restrepo' },
    brand: 'AR.dev',
    email: 'a@correo.co',
    location: { es: 'Medellín', en: 'Medellín' },
    available: true,
    headline: { es: 'Dev', en: 'Dev' },
    role: { es: 'Backend', en: 'Backend' },
    summary: { es: 'Resumen', en: 'Summary' },
    bio: [{ es: 'Parrafo', en: 'Paragraph' }],
    typewriterRoles: [{ es: 'Backend', en: 'Backend' }],
    socials: [{ id: 'github', label: 'GitHub', href: 'https://github.com/a', icon: null }],
    stats: [{ id: 'years', value: 4, suffix: '+', labelKey: 'years' }],
  })

describe('repositorios de TypeORM contra Postgres', () => {
  let dataSource: DataSource

  beforeAll(async () => {
    await ensureTestDatabase()
    dataSource = createTestDataSource()
    await dataSource.initialize()
    await resetSchema(dataSource)
  }, 60_000)

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await truncateAll(dataSource)
  })

  describe('proyectos', () => {
    let repository: TypeOrmProjectRepository

    beforeEach(() => {
      repository = new TypeOrmProjectRepository(dataSource)
    })

    it('guarda y devuelve una entidad de dominio equivalente', async () => {
      await repository.save(project('api-rest', 0))

      const found = await repository.findById('api-rest')

      expect(found?.toPrimitives()).toEqual(project('api-rest', 0).toPrimitives())
    })

    it('devuelve null cuando no existe, sin lanzar', async () => {
      // Decidir que un id ausente es un 404 es del caso de uso, no del
      // repositorio: aqui "no hay fila" es un hecho, no un error.
      expect(await repository.findById('no-existe')).toBeNull()
    })

    it('lista ordenando por position y no por orden de insercion', async () => {
      await repository.save(project('tercero', 2))
      await repository.save(project('primero', 0))
      await repository.save(project('segundo', 1))

      const ids = (await repository.findAll()).map((item) => item.id.value)

      expect(ids).toEqual(['primero', 'segundo', 'tercero'])
    })

    it('actualiza en lugar de duplicar cuando el id ya existe', async () => {
      await repository.save(project('api-rest', 0))
      await repository.save(project('api-rest', 0).patch({ icon: '🚀' }))

      const all = await repository.findAll()

      expect(all).toHaveLength(1)
      expect(all[0]?.icon).toBe('🚀')
    })

    it('borra', async () => {
      await repository.save(project('api-rest', 0))
      await repository.delete('api-rest')

      expect(await repository.findAll()).toEqual([])
    })

    it('reordena intercambiando posiciones ocupadas', async () => {
      // Esta es la prueba de que la UNIQUE de position es DEFERRABLE: al pasar A
      // a la posicion de B, durante un instante las dos filas comparten
      // posicion. Con una UNIQUE inmediata, este test falla.
      await repository.saveAll([project('a', 0), project('b', 1), project('c', 2)])

      const [a, b, c] = await repository.findAll()

      await repository.saveAll([
        (c as Project).withPosition(0),
        (a as Project).withPosition(1),
        (b as Project).withPosition(2),
      ])

      expect((await repository.findAll()).map((item) => item.id.value)).toEqual(['c', 'a', 'b'])
    })

    it('un reordenamiento que falla a mitad no deja el orden a medias', async () => {
      await repository.saveAll([project('a', 0), project('b', 1)])

      // El segundo elemento tiene un id imposible para la base de datos: la
      // transaccion completa debe revertirse.
      await expect(
        dataSource.transaction(async (manager) => {
          await manager.query('UPDATE "projects" SET "position" = 5 WHERE "id" = $1', ['a'])
          await manager.query('INSERT INTO "projects" ("id") VALUES ($1)', ['sin-datos'])
        }),
      ).rejects.toThrow()

      const positions = (await repository.findAll()).map((item) => [item.id.value, item.position])

      expect(positions).toEqual([
        ['a', 0],
        ['b', 1],
      ])
    })
  })

  describe('experiencia', () => {
    it('guarda, lee y conserva el periodo en curso', async () => {
      const repository = new TypeOrmExperienceRepository(dataSource)

      await repository.save(experience('homepower', 0))

      const found = await repository.findById('homepower')

      expect(found?.isCurrent).toBe(true)
      expect(found?.period.end).toBeNull()
    })

    it('conserva un periodo cerrado', async () => {
      const repository = new TypeOrmExperienceRepository(dataSource)

      await repository.save(
        experience('incubant', 0).patch({ period: { start: '2022', end: '2024' } }),
      )

      const found = await repository.findById('incubant')

      expect(found?.isCurrent).toBe(false)
      expect(found?.period.end).toBe('2024')
    })
  })

  describe('categorias de skills', () => {
    const category = (id: string, position: number): SkillCategory =>
      SkillCategory.create({
        id,
        title: { es: 'Backend', en: 'Backend' },
        accent: 'purple',
        items: [
          { name: 'NestJS', icon: 'nestjs-plain', position: 0 },
          { name: 'Node', icon: 'nodejs-plain', position: 1 },
        ],
        position,
      })

    let repository: TypeOrmSkillCategoryRepository

    beforeEach(async () => {
      await seedIcons(dataSource, ['nestjs-plain', 'nodejs-plain', 'fastify-plain'])
      repository = new TypeOrmSkillCategoryRepository(dataSource)
    })

    it('guarda la categoria con sus items y los devuelve ordenados', async () => {
      await repository.save(category('backend', 0))

      const found = await repository.findById('backend')

      expect(found?.items.map((item) => item.name)).toEqual(['NestJS', 'Node'])
    })

    it('agregar un item lo persiste', async () => {
      await repository.save(category('backend', 0))

      const found = await repository.findById('backend')
      await repository.save(
        (found as SkillCategory).addItem({ name: 'Fastify', icon: 'fastify-plain' }),
      )

      expect((await repository.findById('backend'))?.items).toHaveLength(3)
    })

    it('quitar un item lo BORRA de la base de datos', async () => {
      // Sin el borrado explicito en el repositorio, la lista guardada solo
      // creceria y el skill "eliminado" reaparece en la siguiente lectura.
      await repository.save(category('backend', 0))

      const found = await repository.findById('backend')
      const removedId = (found as SkillCategory).items[0]?.id as string

      await repository.save((found as SkillCategory).removeItem(removedId))

      const rows = await dataSource.query<{ count: string }[]>(
        'SELECT count(*)::text AS count FROM "skill_items" WHERE "category_id" = $1',
        ['backend'],
      )

      expect(rows[0]?.count).toBe('1')
      expect((await repository.findById('backend'))?.items.map((item) => item.name)).toEqual([
        'Node',
      ])
    })

    it('borrar la categoria se lleva sus items por la FK en cascada', async () => {
      await repository.save(category('backend', 0))
      await repository.delete('backend')

      const rows = await dataSource.query<{ count: string }[]>(
        'SELECT count(*)::text AS count FROM "skill_items"',
      )

      expect(rows[0]?.count).toBe('0')
    })

    it('lista las categorias por position', async () => {
      await repository.saveAll([category('frontend', 1), category('backend', 0)])

      expect((await repository.findAll()).map((item) => item.id.value)).toEqual([
        'backend',
        'frontend',
      ])
    })
  })

  describe('perfil', () => {
    it('empieza vacio y despues devuelve lo guardado', async () => {
      const repository = new TypeOrmProfileRepository(dataSource)

      expect(await repository.get()).toBeNull()

      await repository.save(profile())

      expect((await repository.get())?.fullName).toBe('Alejandro Restrepo')
    })

    it('guardar dos veces actualiza la unica fila', async () => {
      const repository = new TypeOrmProfileRepository(dataSource)

      await repository.save(profile())
      await repository.save(profile().patch({ available: false }))

      const rows = await dataSource.query<{ count: string }[]>(
        'SELECT count(*)::text AS count FROM "profile"',
      )

      expect(rows[0]?.count).toBe('1')
      expect((await repository.get())?.available).toBe(false)
    })
  })

  describe('usuarios', () => {
    const user = (email: string, role = 'admin', isActive = true): User =>
      User.create({ email, passwordHash: '$2b$12$hash', role, isActive })

    let repository: TypeOrmUserRepository

    beforeEach(() => {
      repository = new TypeOrmUserRepository(dataSource)
    })

    it('encuentra por correo ignorando mayusculas', async () => {
      await repository.save(user('admin@correo.co'))

      // Quien se registro como "Admin@correo.co" va a escribir "admin@correo.co".
      expect((await repository.findByEmail('ADMIN@CORREO.CO'))?.email.value).toBe('admin@correo.co')
    })

    it('devuelve null cuando el correo no existe', async () => {
      expect(await repository.findByEmail('nadie@correo.co')).toBeNull()
    })

    it('cuenta solo los administradores ACTIVOS', async () => {
      await repository.save(user('admin1@correo.co'))
      await repository.save(user('admin2@correo.co', 'admin', false))
      await repository.save(user('editor@correo.co', 'editor'))

      expect(await repository.countActiveAdmins()).toBe(1)
    })

    it('no devuelve el hash en la forma publica', async () => {
      await repository.save(user('admin@correo.co'))

      const found = await repository.findById(
        ((await repository.findByEmail('admin@correo.co')) as User).id,
      )

      expect(found?.toPublic()).not.toHaveProperty('passwordHash')
    })

    it('borra', async () => {
      await repository.save(user('admin@correo.co'))
      const saved = (await repository.findByEmail('admin@correo.co')) as User

      await repository.delete(saved.id)

      expect(await repository.findAll()).toEqual([])
    })
  })
})
