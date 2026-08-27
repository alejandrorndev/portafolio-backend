import { ExperienceItem, Profile, Project, SkillCategory } from '@/domain/entities'
import { InvalidContentError } from '@/domain/errors'
import {
  ExperienceMapper,
  ProfileMapper,
  ProjectMapper,
  SkillCategoryMapper,
  type ExperienceRow,
  type ProfileRow,
  type ProjectRow,
  type SkillCategoryRow,
} from './content.mapper'

/*
 * El test que importa aqui es el de IDA Y VUELTA: dominio → fila → dominio debe
 * devolver exactamente lo mismo.
 *
 * Es el que atrapa el error mas probable de esta capa: agregar una columna y
 * olvidar una de las dos direcciones del mapper. Con el, el campo perdido
 * aparece como una diferencia concreta; sin el, aparece como un dato que se
 * guarda y no vuelve.
 */

const projectRow = {
  id: 'api-rest-eventos',
  type: { es: 'API REST', en: 'REST API' },
  title: { es: 'API de eventos', en: 'Events API' },
  description: { es: 'Descripcion', en: 'Description' },
  tags: ['NestJS', 'PostgreSQL'],
  icon: '🎟️',
  gradientFrom: '#7c3aed',
  gradientTo: '#06b6d4',
  linkDemo: null,
  linkGithub: 'https://github.com/a/b',
  position: 0,
} satisfies ProjectRow

describe('ProjectMapper', () => {
  it('ida y vuelta sin perder nada', () => {
    const domain = ProjectMapper.toDomain(projectRow)
    const back = ProjectMapper.toOrm(domain)

    expect(back).toEqual({
      id: 'api-rest-eventos',
      type: projectRow.type,
      title: projectRow.title,
      description: projectRow.description,
      tags: ['NestJS', 'PostgreSQL'],
      icon: '🎟️',
      gradientFrom: '#7c3aed',
      gradientTo: '#06b6d4',
      linkDemo: null,
      linkGithub: 'https://github.com/a/b',
      position: 0,
    })
  })

  it('une las dos columnas del gradiente en la tupla del dominio', () => {
    expect(ProjectMapper.toDomain(projectRow).gradient.toJSON()).toEqual(['#7c3aed', '#06b6d4'])
  })

  it('un enlace ausente viaja como null a la columna, no como undefined', () => {
    // `undefined` en un UPDATE de TypeORM significa "no toques esta columna", asi
    // que borrar un enlace no lo borraria nunca.
    expect(ProjectMapper.toOrm(ProjectMapper.toDomain(projectRow)).linkDemo).toBeNull()
  })

  it('una fila corrupta falla al leerse, con un error de dominio', () => {
    const corrupt = { ...projectRow, title: { es: 'solo español' } } satisfies ProjectRow

    expect(() => ProjectMapper.toDomain(corrupt)).toThrow(InvalidContentError)
  })
})

const experienceRow = {
  id: 'homepower',
  periodStart: '2024',
  periodEnd: null,
  company: 'Homepower Colombia',
  role: { es: 'Backend', en: 'Backend' },
  description: { es: 'APIs', en: 'APIs' },
  stack: ['NestJS'],
  accent: 'purple',
  position: 0,
} satisfies ExperienceRow

describe('ExperienceMapper', () => {
  it('ida y vuelta sin perder nada', () => {
    expect(ExperienceMapper.toOrm(ExperienceMapper.toDomain(experienceRow))).toEqual({
      id: 'homepower',
      periodStart: '2024',
      periodEnd: null,
      company: 'Homepower Colombia',
      role: experienceRow.role,
      description: experienceRow.description,
      stack: ['NestJS'],
      accent: 'purple',
      position: 0,
    })
  })

  it('period_end nulo se lee como "en curso"', () => {
    expect(ExperienceMapper.toDomain(experienceRow).isCurrent).toBe(true)
  })

  it('y no escribe isCurrent en ninguna columna', () => {
    expect(ExperienceMapper.toOrm(ExperienceMapper.toDomain(experienceRow))).not.toHaveProperty(
      'isCurrent',
    )
  })
})

const categoryRow = {
  id: 'backend',
  title: { es: 'Backend', en: 'Backend' },
  accent: 'purple',
  position: 0,
  items: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'NestJS',
      icon: 'nestjs-plain',
      position: 0,
    },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Node', icon: 'nodejs-plain', position: 1 },
  ],
} satisfies SkillCategoryRow

describe('SkillCategoryMapper', () => {
  it('ida y vuelta de la categoria', () => {
    expect(SkillCategoryMapper.toOrm(SkillCategoryMapper.toDomain(categoryRow))).toEqual({
      id: 'backend',
      title: categoryRow.title,
      accent: 'purple',
      position: 0,
    })
  })

  it('los items salen aparte, con su category_id puesto', () => {
    const items = SkillCategoryMapper.itemsToOrm(SkillCategoryMapper.toDomain(categoryRow))

    expect(items).toEqual([
      {
        id: '11111111-1111-1111-1111-111111111111',
        categoryId: 'backend',
        name: 'NestJS',
        icon: 'nestjs-plain',
        position: 0,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        categoryId: 'backend',
        name: 'Node',
        icon: 'nodejs-plain',
        position: 1,
      },
    ])
  })

  it('una fila sin la relacion cargada falla en vez de devolver una categoria vacia', () => {
    // Seria un error de la consulta, no un dato valido: una categoria sin skills
    // se renderiza como un titulo suelto sin nada debajo.
    const withoutItems: SkillCategoryRow = { ...categoryRow, items: undefined }

    expect(() => SkillCategoryMapper.toDomain(withoutItems)).toThrow(/items: necesita al menos/)
  })
})

const profileRow = {
  id: 'singleton',
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
  socials: [
    { id: 'github', label: 'GitHub', href: 'https://github.com/a', icon: null, position: 0 },
  ],
  stats: [{ id: 'years', value: 4, suffix: '+', labelKey: 'years', position: 0 }],
  cv: null,
} satisfies ProfileRow

describe('ProfileMapper', () => {
  it('ida y vuelta sin perder nada, incluido el id singleton', () => {
    const back = ProfileMapper.toOrm(ProfileMapper.toDomain(profileRow))

    expect(back.id).toBe('singleton')
    expect(back.socials).toEqual(profileRow.socials)
    expect(back.stats).toEqual(profileRow.stats)
    expect(back.cv).toBeNull()
  })

  it('el cv presente sobrevive el viaje', () => {
    const withCv = {
      ...profileRow,
      cv: { es: '/cv/es.pdf', en: '/cv/en.pdf' },
    } satisfies ProfileRow

    expect(ProfileMapper.toOrm(ProfileMapper.toDomain(withCv)).cv).toEqual({
      es: '/cv/es.pdf',
      en: '/cv/en.pdf',
    })
  })

  it('normaliza el correo al leerlo', () => {
    const upper = { ...profileRow, email: 'A@Correo.CO' } satisfies ProfileRow

    expect(ProfileMapper.toOrm(ProfileMapper.toDomain(upper)).email).toBe('a@correo.co')
  })
})

describe('las entidades de dominio sobreviven el viaje completo', () => {
  it('Project', () => {
    const project = ProjectMapper.toDomain(projectRow)
    const revived = ProjectMapper.toDomain({
      ...projectRow,
      ...ProjectMapper.toOrm(project),
    } as ProjectRow)

    expect(revived.toPrimitives()).toEqual(project.toPrimitives())
    expect(revived).toBeInstanceOf(Project)
  })

  it('ExperienceItem', () => {
    const item = ExperienceMapper.toDomain(experienceRow)

    expect(item).toBeInstanceOf(ExperienceItem)
    expect(
      ExperienceMapper.toDomain({
        ...experienceRow,
        ...ExperienceMapper.toOrm(item),
      } as ExperienceRow).toPrimitives(),
    ).toEqual(item.toPrimitives())
  })

  it('SkillCategory', () => {
    const category = SkillCategoryMapper.toDomain(categoryRow)

    expect(category).toBeInstanceOf(SkillCategory)
    expect(category.items).toHaveLength(2)
  })

  it('Profile', () => {
    expect(ProfileMapper.toDomain(profileRow)).toBeInstanceOf(Profile)
  })
})
