import { ExperienceItem, Profile, Project, SkillCategory } from '@/domain/entities'
import { AdminPresenter, ContentPresenter } from './content.presenter'

/*
 * Los presenters son la frontera con el front, y estos tests fijan la forma. El
 * contrato completo se comprueba por HTTP en `test/front-contract.e2e-spec.ts`;
 * aqui se prueban las decisiones una por una, sin levantar nada.
 */

const project = Project.create({
  id: 'api-rest-eventos',
  type: { es: 'API REST · Backend', en: 'REST API · Backend' },
  title: { es: 'API de eventos', en: 'Events API' },
  description: { es: 'Descripción', en: 'Description' },
  tags: ['NestJS'],
  icon: '🎟️',
  gradient: ['#7C3AED', '#06b6d4'],
  links: { github: 'https://github.com/a/b' },
  position: 3,
})

const experience = ExperienceItem.create({
  id: 'homepower',
  period: { start: '2025', end: null },
  company: 'Homepower',
  role: { es: 'Backend', en: 'Backend' },
  description: { es: 'APIs', en: 'APIs' },
  stack: ['NestJS'],
  accent: 'purple',
  position: 0,
})

const category = SkillCategory.create({
  id: 'backend',
  title: { es: 'Backend', en: 'Backend' },
  accent: 'purple',
  items: [{ id: 'item-1', name: 'NestJS', icon: 'nestjs-plain', position: 0 }],
  position: 1,
})

const profileInput = {
  fullName: 'Alejandro Restrepo',
  displayName: { first: 'Alejandro', last: 'Restrepo' },
  brand: 'AR.dev',
  email: 'a@correo.co',
  location: { es: 'Medellín, Colombia', en: 'Medellín, Colombia' },
  available: true,
  headline: { es: 'Desarrollador', en: 'Developer' },
  role: { es: 'Backend', en: 'Backend' },
  summary: { es: 'Resumen', en: 'Summary' },
  bio: [{ es: 'Párrafo', en: 'Paragraph' }],
  typewriterRoles: [{ es: 'Backend', en: 'Backend' }],
  socials: [{ id: 'github', label: 'GitHub', href: 'https://github.com/a', icon: null }],
  stats: [{ id: 'years', value: 4, suffix: '+', labelKey: 'yearsExperience' }],
}

describe('ContentPresenter', () => {
  describe('project', () => {
    it('resuelve el texto al idioma pedido', () => {
      expect(ContentPresenter.project(project, 'es').title).toBe('API de eventos')
      expect(ContentPresenter.project(project, 'en').title).toBe('Events API')
    })

    it('NO expone position: en el front el orden es el del array', () => {
      expect(ContentPresenter.project(project, 'es')).not.toHaveProperty('position')
    })

    it('devuelve el gradiente como tupla, normalizado a minusculas', () => {
      expect(ContentPresenter.project(project, 'es').gradient).toEqual(['#7c3aed', '#06b6d4'])
    })

    it('omite los enlaces ausentes en vez de ponerlos en null', () => {
      const links = ContentPresenter.project(project, 'es').links

      expect(links).toEqual({ github: 'https://github.com/a/b' })
      expect(links).not.toHaveProperty('demo')
    })

    it('las claves son exactamente las de ResolvedProject del front', () => {
      expect(Object.keys(ContentPresenter.project(project, 'es')).sort()).toEqual([
        'description',
        'gradient',
        'icon',
        'id',
        'links',
        'tags',
        'title',
        'type',
      ])
    })
  })

  describe('experienceItem', () => {
    it('incluye isCurrent derivado del periodo', () => {
      expect(ContentPresenter.experienceItem(experience, 'es').isCurrent).toBe(true)
    })

    it('un periodo cerrado no esta en curso', () => {
      const closed = experience.patch({ period: { start: '2023', end: '2024' } })

      expect(ContentPresenter.experienceItem(closed, 'es').isCurrent).toBe(false)
    })

    it('no expone position', () => {
      expect(ContentPresenter.experienceItem(experience, 'es')).not.toHaveProperty('position')
    })
  })

  describe('skillCategory', () => {
    it('los items llevan SOLO name e icon', () => {
      // El tipo del front es `{ name, icon }`: no conoce ids ni posiciones.
      const items = ContentPresenter.skillCategory(category, 'es').items

      expect(items).toEqual([{ name: 'NestJS', icon: 'nestjs-plain' }])
    })
  })

  describe('profile', () => {
    it('resuelve las listas de texto al idioma pedido', () => {
      const profile = ContentPresenter.profile(Profile.create(profileInput), 'en')

      expect(profile.bio).toEqual(['Paragraph'])
      expect(profile.typewriterRoles).toEqual(['Backend'])
    })

    it('cv ausente es undefined, NO null', () => {
      // El tipo del front es `string | undefined`, y en JSON `undefined` omite la
      // clave. Un null cambiaria el significado de la comprobacion que hace la
      // vista para mostrar el boton de descarga.
      const profile = ContentPresenter.profile(Profile.create(profileInput), 'es')

      expect(profile.cv).toBeUndefined()
      expect(profile.cv).not.toBeNull()
    })

    it('cv presente viene resuelto al idioma', () => {
      const withCv = Profile.create({
        ...profileInput,
        cv: { es: '/cv/es.pdf', en: '/cv/en.pdf' },
      })

      expect(ContentPresenter.profile(withCv, 'en').cv).toBe('/cv/en.pdf')
    })

    it('un social sin icono conserva el null que el front admite', () => {
      const profile = ContentPresenter.profile(Profile.create(profileInput), 'es')

      expect(profile.socials[0]?.icon).toBeNull()
    })

    it('las claves son exactamente las de ResolvedProfile', () => {
      expect(
        Object.keys(ContentPresenter.profile(Profile.create(profileInput), 'es')).sort(),
      ).toEqual([
        'available',
        'bio',
        'brand',
        'cv',
        'displayName',
        'email',
        'fullName',
        'headline',
        'location',
        'role',
        'socials',
        'stats',
        'summary',
        'typewriterRoles',
      ])
    })

    it('displayName es una copia, no la referencia de la entidad', () => {
      const entity = Profile.create(profileInput)
      const presented = ContentPresenter.profile(entity, 'es')

      presented.displayName.first = 'Modificado'

      expect(entity.displayName.first).toBe('Alejandro')
    })
  })
})

describe('AdminPresenter', () => {
  it('devuelve los objetos bilingues completos', () => {
    const presented = AdminPresenter.project(project)

    expect(presented.title).toEqual({ es: 'API de eventos', en: 'Events API' })
    expect(presented.position).toBe(3)
  })

  it('los items de skills SI llevan id, que es lo que permite reordenarlos', () => {
    expect(AdminPresenter.skillCategory(category).items[0]?.id).toBe('item-1')
  })

  it('la experiencia de admin no incluye isCurrent: se deriva al presentarla', () => {
    expect(AdminPresenter.experienceItem(experience)).not.toHaveProperty('isCurrent')
  })

  it('el perfil de admin conserva el id singleton', () => {
    expect(AdminPresenter.profile(Profile.create(profileInput)).id).toBe('singleton')
  })
})
