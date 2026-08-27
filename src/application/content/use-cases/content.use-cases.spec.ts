import { ExperienceItem, Profile, SkillCategory, User } from '@/domain/entities'
import { ForbiddenActionError, InvalidContentError, NotFoundError } from '@/domain/errors'
import type {
  IExperienceRepository,
  IProfileRepository,
  ISkillCategoryRepository,
} from '@/domain/ports'
import { FakeOrderedRepository } from './__fakes__/ordered.repository.fake'
import {
  CreateExperienceUseCase,
  DeleteExperienceUseCase,
  GetExperienceUseCase,
  ListExperienceUseCase,
  ReorderExperienceUseCase,
  UpdateExperienceUseCase,
} from './experience.use-cases'
import { CreateProfileUseCase, GetProfileUseCase, UpdateProfileUseCase } from './profile.use-cases'
import {
  CreateSkillCategoryUseCase,
  DeleteSkillCategoryUseCase,
  GetSkillCategoryUseCase,
  ListSkillCategoriesUseCase,
  ReorderSkillCategoriesUseCase,
  UpdateSkillCategoryUseCase,
} from './skill-category.use-cases'
import {
  AddSkillItemUseCase,
  RemoveSkillItemUseCase,
  ReorderSkillItemsUseCase,
} from './skill-item.use-cases'

// Los casos de uso autorizan con un Actor, no con la cuenta completa: para
// decidir permisos basta la identidad, y asi el guard puede construirlo del
// payload del token sin consultar la base de datos.
const admin = User.create({
  email: 'admin@correo.co',
  passwordHash: '$2b$12$h',
  role: 'admin',
}).toActor()
const editor = User.create({
  email: 'editor@correo.co',
  passwordHash: '$2b$12$h',
  role: 'editor',
}).toActor()

// --- Experiencia -------------------------------------------------------------

const experienceInput = (id: string) => ({
  id,
  period: { start: '2024', end: null },
  company: 'Homepower',
  role: { es: 'Backend', en: 'Backend' },
  description: { es: 'APIs', en: 'APIs' },
  stack: ['NestJS'],
  accent: 'purple',
})

const experience = (id: string, position: number) =>
  ExperienceItem.create({ ...experienceInput(id), position })

describe('casos de uso de experiencia', () => {
  let repository: FakeOrderedRepository<ExperienceItem>

  const asPort = (): IExperienceRepository => repository

  beforeEach(() => {
    repository = new FakeOrderedRepository<ExperienceItem>()
  })

  it('crea al final y lista por position', async () => {
    const useCase = new CreateExperienceUseCase(asPort())

    await useCase.execute(experienceInput('homepower'))
    await useCase.execute(experienceInput('incubant'))

    const all = await new ListExperienceUseCase(asPort()).execute()

    expect(all.map((item) => [item.id.value, item.position])).toEqual([
      ['homepower', 0],
      ['incubant', 1],
    ])
  })

  it('cerrar un periodo es una edicion normal', async () => {
    await repository.save(experience('homepower', 0))

    const updated = await new UpdateExperienceUseCase(asPort()).execute('homepower', {
      period: { start: '2024', end: '2026' },
    })

    expect(updated.isCurrent).toBe(false)
  })

  it('el nombre del recurso viaja en el codigo del error', async () => {
    await expect(
      new UpdateExperienceUseCase(asPort()).execute('fantasma', { company: 'X' }),
    ).rejects.toMatchObject({ code: 'EXPERIENCE_NOT_FOUND' })
  })

  it('solo un admin borra', async () => {
    await repository.save(experience('homepower', 0))

    await expect(
      new DeleteExperienceUseCase(asPort()).execute('homepower', editor),
    ).rejects.toThrow(ForbiddenActionError)

    await new DeleteExperienceUseCase(asPort()).execute('homepower', admin)

    expect(await repository.findAll()).toEqual([])
  })

  it('reordena', async () => {
    await repository.saveAll([experience('a', 0), experience('b', 1)])

    const result = await new ReorderExperienceUseCase(asPort()).execute(['b', 'a'])

    expect(result.map((item) => item.id.value)).toEqual(['b', 'a'])
  })

  it('lee una experiencia por id', async () => {
    await repository.save(experience('homepower', 0))

    expect((await new GetExperienceUseCase(asPort()).execute('homepower')).company).toBe(
      'Homepower',
    )
  })
})

// --- Categorias de skills ----------------------------------------------------

const categoryInput = (id: string) => ({
  id,
  title: { es: 'Backend', en: 'Backend' },
  accent: 'purple',
  items: [{ id: 'item-1', name: 'NestJS', icon: 'nestjs-plain', position: 0 }],
})

const category = (id: string, position: number) =>
  SkillCategory.create({ ...categoryInput(id), position })

describe('casos de uso de categorias de skills', () => {
  let repository: FakeOrderedRepository<SkillCategory>

  const asPort = (): ISkillCategoryRepository => repository

  beforeEach(() => {
    repository = new FakeOrderedRepository<SkillCategory>()
  })

  it('crea una categoria con sus items', async () => {
    const created = await new CreateSkillCategoryUseCase(asPort()).execute(categoryInput('backend'))

    expect(created.items).toHaveLength(1)
    expect(created.position).toBe(0)
  })

  it('exige al menos un skill al crear', async () => {
    await expect(
      new CreateSkillCategoryUseCase(asPort()).execute({ ...categoryInput('backend'), items: [] }),
    ).rejects.toThrow(InvalidContentError)
  })

  it('lee una categoria y falla con su codigo cuando no existe', async () => {
    await expect(new GetSkillCategoryUseCase(asPort()).execute('fantasma')).rejects.toMatchObject({
      code: 'SKILL_CATEGORY_NOT_FOUND',
    })
  })

  it('solo un admin borra una categoria completa', async () => {
    await repository.save(category('backend', 0))

    await expect(
      new DeleteSkillCategoryUseCase(asPort()).execute('backend', editor),
    ).rejects.toThrow(ForbiddenActionError)
  })

  it('lista las categorias ordenadas', async () => {
    await repository.saveAll([category('frontend', 1), category('backend', 0)])

    const all = await new ListSkillCategoriesUseCase(asPort()).execute()

    expect(all.map((item) => item.id.value)).toEqual(['backend', 'frontend'])
  })

  it('edita el titulo de una categoria sin tocar sus items', async () => {
    await repository.save(category('backend', 0))

    const updated = await new UpdateSkillCategoryUseCase(asPort()).execute('backend', {
      title: { es: 'Backend y APIs', en: 'Backend and APIs' },
    })

    expect(updated.title.get('es')).toBe('Backend y APIs')
    expect(updated.items).toHaveLength(1)
  })

  it('reordena categorias', async () => {
    await repository.saveAll([category('backend', 0), category('frontend', 1)])

    const result = await new ReorderSkillCategoriesUseCase(asPort()).execute([
      'frontend',
      'backend',
    ])

    expect(result.map((item) => item.id.value)).toEqual(['frontend', 'backend'])
  })
})

describe('casos de uso de skills dentro de una categoria', () => {
  let repository: FakeOrderedRepository<SkillCategory>

  const asPort = (): ISkillCategoryRepository => repository

  beforeEach(async () => {
    repository = new FakeOrderedRepository<SkillCategory>()
    await repository.save(
      SkillCategory.create({
        ...categoryInput('backend'),
        items: [
          { id: 'item-1', name: 'NestJS', icon: 'nestjs-plain', position: 0 },
          { id: 'item-2', name: 'Node', icon: 'nodejs-plain', position: 1 },
        ],
        position: 0,
      }),
    )
  })

  it('agrega un skill al final de su categoria', async () => {
    const updated = await new AddSkillItemUseCase(asPort()).execute('backend', {
      name: 'Fastify',
      icon: 'fastify-plain',
    })

    expect(updated.items.map((item) => item.name)).toEqual(['NestJS', 'Node', 'Fastify'])
  })

  it('falla si la categoria no existe', async () => {
    await expect(
      new AddSkillItemUseCase(asPort()).execute('fantasma', { name: 'X', icon: 'x' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('quitar un skill exige rol de admin', async () => {
    // Es borrar contenido, igual que borrar un proyecto: no hay historial que lo
    // recupere.
    await expect(
      new RemoveSkillItemUseCase(asPort()).execute('backend', 'item-1', editor),
    ).rejects.toThrow(ForbiddenActionError)
  })

  it('un admin quita el skill y las posiciones se recompactan', async () => {
    const updated = await new RemoveSkillItemUseCase(asPort()).execute('backend', 'item-1', admin)

    expect(updated.items.map((item) => [item.name, item.position])).toEqual([['Node', 0]])
  })

  it('no deja vaciar una categoria', async () => {
    const useCase = new RemoveSkillItemUseCase(asPort())

    await useCase.execute('backend', 'item-1', admin)

    await expect(useCase.execute('backend', 'item-2', admin)).rejects.toThrow(
      /no puede quedarse sin skills/,
    )
  })

  it('reordena los skills de una categoria', async () => {
    const updated = await new ReorderSkillItemsUseCase(asPort()).execute('backend', [
      'item-2',
      'item-1',
    ])

    expect(updated.items.map((item) => item.name)).toEqual(['Node', 'NestJS'])
  })

  it('rechaza un orden que no incluye todos los skills', async () => {
    await expect(
      new ReorderSkillItemsUseCase(asPort()).execute('backend', ['item-1']),
    ).rejects.toThrow(InvalidContentError)
  })
})

// --- Perfil ------------------------------------------------------------------

const profileInput = {
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
}

class FakeProfileRepository implements IProfileRepository {
  private profile: Profile | null = null

  async get(): Promise<Profile | null> {
    return this.profile
  }

  async save(profile: Profile): Promise<void> {
    this.profile = profile
  }
}

describe('casos de uso del perfil', () => {
  let repository: FakeProfileRepository

  beforeEach(() => {
    repository = new FakeProfileRepository()
  })

  it('leer sin perfil sembrado es un 404, no un perfil vacio', async () => {
    // Un perfil vacio lo pintaria el front como una pagina en blanco; el 404
    // dice lo que pasa: falta correr el seed.
    await expect(new GetProfileUseCase(repository).execute()).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    })
  })

  it('crea el perfil inicial', async () => {
    const created = await new CreateProfileUseCase(repository).execute(profileInput)

    expect(created.fullName).toBe('Alejandro Restrepo')
    expect((await new GetProfileUseCase(repository).execute()).brand).toBe('AR.dev')
  })

  it('crear dos veces no pisa lo que ya existe', async () => {
    // El seed es idempotente: correrlo de nuevo no puede deshacer ediciones
    // hechas desde el panel.
    await new CreateProfileUseCase(repository).execute(profileInput)
    await new UpdateProfileUseCase(repository).execute({ brand: 'Editado' })

    const second = await new CreateProfileUseCase(repository).execute(profileInput)

    expect(second.brand).toBe('Editado')
  })

  it('edita el perfil existente', async () => {
    await new CreateProfileUseCase(repository).execute(profileInput)

    const updated = await new UpdateProfileUseCase(repository).execute({ available: false })

    expect(updated.available).toBe(false)
  })

  it('editar sin perfil sembrado es un 404', async () => {
    await expect(
      new UpdateProfileUseCase(repository).execute({ available: false }),
    ).rejects.toThrow(NotFoundError)
  })

  it('un cambio invalido no se guarda', async () => {
    await new CreateProfileUseCase(repository).execute(profileInput)

    await expect(new UpdateProfileUseCase(repository).execute({ socials: [] })).rejects.toThrow(
      InvalidContentError,
    )

    expect((await new GetProfileUseCase(repository).execute()).socials).toHaveLength(1)
  })
})
