import { InvalidContentError, NotFoundError } from '@/domain/errors'
import { ExperienceItem } from './experience-item.entity'
import { Profile } from './profile.entity'
import { Project } from './project.entity'
import { SkillCategory } from './skill-category.entity'

const projectInput = {
  id: 'api-rest-eventos',
  type: { es: 'API REST · Backend', en: 'REST API · Backend' },
  title: { es: 'API de eventos', en: 'Events API' },
  description: { es: 'Descripcion larga', en: 'Long description' },
  tags: ['NestJS', 'PostgreSQL'],
  icon: '🎟️',
  gradient: ['#7c3aed', '#06b6d4'],
  links: { github: 'https://github.com/a/b' },
  position: 0,
}

describe('Project', () => {
  it('se construye y vuelve a primitivos sin perder nada', () => {
    const project = Project.create(projectInput)

    expect(project.toPrimitives()).toEqual({
      ...projectInput,
      gradient: ['#7c3aed', '#06b6d4'],
    })
  })

  it('exige al menos un tag', () => {
    expect(() => Project.create({ ...projectInput, tags: [] })).toThrow(/tags: necesita al menos/)
  })

  it('exige al menos un enlace', () => {
    expect(() => Project.create({ ...projectInput, links: {} })).toThrow(/al menos un enlace/)
  })

  it('exige los dos idiomas en cada texto traducido', () => {
    expect(() => Project.create({ ...projectInput, title: { es: 'solo español' } })).toThrow(
      /project.title: falta el idioma "en"/,
    )
  })

  it('rechaza una position negativa', () => {
    expect(() => Project.create({ ...projectInput, position: -1 })).toThrow(
      /position: se esperaba un entero no negativo/,
    )
  })

  it('patch devuelve una copia y no muta el original', () => {
    const project = Project.create(projectInput)
    const renamed = project.patch({ title: { es: 'Nuevo', en: 'New' } })

    expect(renamed.title.get('es')).toBe('Nuevo')
    expect(project.title.get('es')).toBe('API de eventos')
  })

  it('patch revalida: no deja escribir un valor invalido', () => {
    expect(() => Project.create(projectInput).patch({ id: 'MAYUSCULAS' })).toThrow(
      InvalidContentError,
    )
  })

  it('withPosition solo cambia el orden', () => {
    const moved = Project.create(projectInput).withPosition(3)

    expect(moved.position).toBe(3)
    expect(moved.id.value).toBe('api-rest-eventos')
  })
})

const experienceInput = {
  id: 'homepower',
  period: { start: '2024', end: null },
  company: 'Homepower Colombia',
  role: { es: 'Backend Developer', en: 'Backend Developer' },
  description: { es: 'APIs con NestJS', en: 'APIs with NestJS' },
  stack: ['NestJS', 'AWS'],
  accent: 'purple',
  position: 0,
}

describe('ExperienceItem', () => {
  it('deriva isCurrent del periodo en vez de almacenarlo', () => {
    expect(ExperienceItem.create(experienceInput).isCurrent).toBe(true)
    expect(
      ExperienceItem.create({ ...experienceInput, period: { start: '2022', end: '2024' } })
        .isCurrent,
    ).toBe(false)
  })

  it('no expone isCurrent en los primitivos: se recalcula, no se guarda', () => {
    expect(ExperienceItem.create(experienceInput).toPrimitives()).not.toHaveProperty('isCurrent')
  })

  it('exige un acento del sistema de diseño', () => {
    expect(() => ExperienceItem.create({ ...experienceInput, accent: 'red' })).toThrow(
      /no es un acento valido/,
    )
  })

  it('exige al menos una tecnologia en el stack', () => {
    expect(() => ExperienceItem.create({ ...experienceInput, stack: [] })).toThrow(
      /stack: necesita al menos/,
    )
  })

  it('conserva todo al ir y volver de primitivos', () => {
    const item = ExperienceItem.create(experienceInput)

    expect(ExperienceItem.create(item.toPrimitives()).toPrimitives()).toEqual(item.toPrimitives())
  })

  it('patch cierra un periodo en curso sin tocar el resto', () => {
    const closed = ExperienceItem.create(experienceInput).patch({
      period: { start: '2024', end: '2026' },
    })

    expect(closed.isCurrent).toBe(false)
    expect(closed.company).toBe('Homepower Colombia')
  })

  it('patch revalida', () => {
    expect(() => ExperienceItem.create(experienceInput).patch({ accent: 'red' })).toThrow(
      /no es un acento valido/,
    )
  })

  it('withPosition solo mueve el elemento', () => {
    const moved = ExperienceItem.create(experienceInput).withPosition(2)

    expect(moved.position).toBe(2)
    expect(moved.id.value).toBe('homepower')
  })
})

const categoryInput = {
  id: 'backend',
  title: { es: 'Backend', en: 'Backend' },
  accent: 'purple',
  items: [
    { id: 'a', name: 'NestJS', icon: 'nestjs-plain', position: 0 },
    { id: 'b', name: 'Node.js', icon: 'nodejs-plain', position: 1 },
  ],
  position: 0,
}

describe('SkillCategory', () => {
  it('ordena los items por position, no por orden de llegada', () => {
    const category = SkillCategory.create({
      ...categoryInput,
      items: [
        { id: 'b', name: 'Node.js', icon: 'nodejs-plain', position: 1 },
        { id: 'a', name: 'NestJS', icon: 'nestjs-plain', position: 0 },
      ],
    })

    expect(category.items.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('genera el id de un item nuevo cuando no se da', () => {
    const category = SkillCategory.create(categoryInput).addItem({
      name: 'Fastify',
      icon: 'fastify-plain',
    })

    const added = category.items[2]

    expect(added?.name).toBe('Fastify')
    expect(added?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(added?.position).toBe(2)
  })

  it('exige al menos un skill al crear', () => {
    expect(() => SkillCategory.create({ ...categoryInput, items: [] })).toThrow(
      /items: necesita al menos/,
    )
  })

  it('quitar un item recompacta las posiciones', () => {
    const category = SkillCategory.create(categoryInput).removeItem('a')

    expect(category.items.map((item) => [item.id, item.position])).toEqual([['b', 0]])
  })

  it('quitar un item que no existe es un 404, no un no-op silencioso', () => {
    expect(() => SkillCategory.create(categoryInput).removeItem('zzz')).toThrow(NotFoundError)
  })

  it('no deja una categoria sin skills', () => {
    // Una categoria vacia se renderiza como un titulo suelto sin nada debajo.
    const oneItem = SkillCategory.create({ ...categoryInput, items: [categoryInput.items[0]] })

    expect(() => oneItem.removeItem('a')).toThrow(/no puede quedarse sin skills/)
  })

  it('reordena segun la lista de ids', () => {
    const category = SkillCategory.create(categoryInput).reorderItems(['b', 'a'])

    expect(category.items.map((item) => [item.id, item.position])).toEqual([
      ['b', 0],
      ['a', 1],
    ])
  })

  it.each([
    ['falta un id', ['a']],
    ['sobra un id', ['a', 'b', 'c']],
    ['un id desconocido', ['a', 'z']],
  ])('rechaza un orden incompleto o ajeno: %s', (_label, ids) => {
    expect(() => SkillCategory.create(categoryInput).reorderItems(ids)).toThrow(
      /exactamente los skills existentes/,
    )
  })

  it('patch cambia el titulo sin perder los items', () => {
    const renamed = SkillCategory.create(categoryInput).patch({
      title: { es: 'Backend y APIs', en: 'Backend and APIs' },
    })

    expect(renamed.title.get('es')).toBe('Backend y APIs')
    expect(renamed.items).toHaveLength(2)
  })

  it('patch revalida', () => {
    expect(() => SkillCategory.create(categoryInput).patch({ id: 'Backend' })).toThrow(/kebab-case/)
  })

  it('withPosition solo mueve la categoria', () => {
    expect(SkillCategory.create(categoryInput).withPosition(3).position).toBe(3)
  })

  it('no muta el original al reordenar', () => {
    const category = SkillCategory.create(categoryInput)
    category.reorderItems(['b', 'a'])

    expect(category.items.map((item) => item.id)).toEqual(['a', 'b'])
  })
})

const profileInput = {
  fullName: 'Alejandro Stiven Restrepo Naranjo',
  displayName: { first: 'Alejandro', last: 'Restrepo' },
  brand: 'AR.dev',
  email: 'alejandrorn.dev@gmail.com',
  location: { es: 'Medellín, Colombia', en: 'Medellín, Colombia' },
  available: true,
  headline: { es: 'Desarrollador de Software', en: 'Software Developer' },
  role: { es: 'Backend Developer', en: 'Backend Developer' },
  summary: { es: 'Resumen', en: 'Summary' },
  bio: [{ es: 'Parrafo', en: 'Paragraph' }],
  typewriterRoles: [{ es: 'Backend', en: 'Backend' }],
  socials: [
    {
      id: 'github',
      label: 'GitHub',
      href: 'https://github.com/a',
      icon: 'github-original',
      position: 0,
    },
  ],
  stats: [
    { id: 'years-experience', value: 4, suffix: '+', labelKey: 'yearsExperience', position: 0 },
  ],
}

describe('Profile', () => {
  it('siempre tiene el mismo id: hay exactamente un perfil', () => {
    expect(Profile.create(profileInput).id).toBe('singleton')
  })

  it('cv ausente es null, no un enlace roto', () => {
    // Un boton "Descargar CV" que devuelve 404 no se vuelve a pulsar.
    expect(Profile.create(profileInput).cv).toBeNull()
  })

  it('acepta un cv explicitamente nulo igual que uno ausente', () => {
    expect(Profile.create({ ...profileInput, cv: null }).cv).toBeNull()
  })

  it('acepta el cv cuando esta en los dos idiomas', () => {
    const profile = Profile.create({ ...profileInput, cv: { es: '/cv/es.pdf', en: '/cv/en.pdf' } })

    expect(profile.cv?.get('en')).toBe('/cv/en.pdf')
  })

  it('rechaza un cv que solo esta en un idioma', () => {
    expect(() => Profile.create({ ...profileInput, cv: { es: '/cv/es.pdf' } })).toThrow(
      /profile.cv: falta el idioma "en"/,
    )
  })

  it('normaliza el correo a minusculas', () => {
    expect(Profile.create({ ...profileInput, email: 'AR@Correo.CO' }).email.value).toBe(
      'ar@correo.co',
    )
  })

  it('permite un mailto en una red social, que https prohibiria', () => {
    const profile = Profile.create({
      ...profileInput,
      socials: [{ id: 'email', label: 'Email', href: 'mailto:a@b.co', icon: null, position: 0 }],
    })

    expect(profile.socials[0]?.href).toBe('mailto:a@b.co')
    expect(profile.socials[0]?.icon).toBeNull()
  })

  it('exige al menos una red y un stat', () => {
    expect(() => Profile.create({ ...profileInput, socials: [] })).toThrow(/socials: necesita/)
    expect(() => Profile.create({ ...profileInput, stats: [] })).toThrow(/stats: necesita/)
  })

  it('acepta un stat con sufijo vacio', () => {
    // "4 empresas" no lleva "+".
    const profile = Profile.create({
      ...profileInput,
      stats: [{ id: 'companies', value: 4, suffix: '', labelKey: 'companies', position: 0 }],
    })

    expect(profile.stats[0]?.suffix).toBe('')
  })

  it('ordena socials y stats por position, no por orden de llegada', () => {
    const profile = Profile.create({
      ...profileInput,
      socials: [
        { id: 'linkedin', label: 'LinkedIn', href: 'https://in.co/a', icon: null, position: 1 },
        { id: 'github', label: 'GitHub', href: 'https://github.com/a', icon: null, position: 0 },
      ],
      stats: [
        { id: 'companies', value: 4, suffix: '', labelKey: 'companies', position: 1 },
        { id: 'years-experience', value: 4, suffix: '+', labelKey: 'years', position: 0 },
      ],
    })

    expect(profile.socials.map((social) => social.id.value)).toEqual(['github', 'linkedin'])
    expect(profile.stats.map((stat) => stat.id.value)).toEqual(['years-experience', 'companies'])
  })

  it('exige nombre y apellido para mostrar', () => {
    expect(() => Profile.create({ ...profileInput, displayName: undefined })).toThrow(
      /profile.displayName.first/,
    )
    expect(() => Profile.create({ ...profileInput, displayName: { first: 'Alejandro' } })).toThrow(
      /profile.displayName.last/,
    )
  })

  it('patch conserva el id singleton', () => {
    const updated = Profile.create(profileInput).patch({ available: false })

    expect(updated.id).toBe('singleton')
    expect(updated.available).toBe(false)
  })

  it('conserva todo al ir y volver de primitivos', () => {
    const profile = Profile.create(profileInput)
    const { id: _id, ...primitives } = profile.toPrimitives()

    expect(Profile.create(primitives).toPrimitives()).toEqual(profile.toPrimitives())
  })
})
