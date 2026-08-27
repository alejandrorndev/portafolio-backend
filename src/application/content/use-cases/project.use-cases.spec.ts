import { Project, User } from '@/domain/entities'
import {
  DuplicateSlugError,
  ForbiddenActionError,
  InvalidContentError,
  NotFoundError,
} from '@/domain/errors'
import type { IProjectRepository } from '@/domain/ports'
import { FakeOrderedRepository } from './__fakes__/ordered.repository.fake'
import {
  CreateProjectUseCase,
  DeleteProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  ReorderProjectsUseCase,
  UpdateProjectUseCase,
} from './project.use-cases'

/*
 * Los casos de uso de proyectos son la instancia concreta de la logica generica
 * de `ordered-content.usecase.ts`, asi que probarlos aqui prueba las dos cosas:
 * la logica compartida y que este agregado la ata bien (su repositorio y el
 * nombre de recurso que sale en los codigos de error).
 */

const input = (id: string) => ({
  id,
  type: { es: 'API REST', en: 'REST API' },
  title: { es: `Proyecto ${id}`, en: `Project ${id}` },
  description: { es: 'Descripcion', en: 'Description' },
  tags: ['NestJS'],
  icon: '🎟️',
  gradient: ['#7c3aed', '#06b6d4'],
  links: { github: `https://github.com/a/${id}` },
})

const project = (id: string, position: number) => Project.create({ ...input(id), position })

const admin = User.create({ email: 'admin@correo.co', passwordHash: '$2b$12$h', role: 'admin' })
const editor = User.create({ email: 'editor@correo.co', passwordHash: '$2b$12$h', role: 'editor' })

describe('casos de uso de proyectos', () => {
  let repository: FakeOrderedRepository<Project>

  const asPort = (): IProjectRepository => repository

  beforeEach(() => {
    repository = new FakeOrderedRepository<Project>()
  })

  describe('listar', () => {
    it('devuelve los proyectos ordenados por position', async () => {
      await repository.saveAll([project('c', 2), project('a', 0), project('b', 1)])

      const result = await new ListProjectsUseCase(asPort()).execute()

      expect(result.map((item) => item.id.value)).toEqual(['a', 'b', 'c'])
    })

    it('una lista vacia es una lista vacia, no un error', async () => {
      expect(await new ListProjectsUseCase(asPort()).execute()).toEqual([])
    })
  })

  describe('leer uno', () => {
    it('lo devuelve cuando existe', async () => {
      await repository.save(project('api-rest', 0))

      expect((await new GetProjectUseCase(asPort()).execute('api-rest')).id.value).toBe('api-rest')
    })

    it('lanza NotFoundError con el codigo del recurso', async () => {
      const useCase = new GetProjectUseCase(asPort())

      await expect(useCase.execute('fantasma')).rejects.toThrow(NotFoundError)
      await expect(useCase.execute('fantasma')).rejects.toMatchObject({
        code: 'PROJECT_NOT_FOUND',
      })
    })
  })

  describe('crear', () => {
    it('asigna la position al final de la lista', async () => {
      const useCase = new CreateProjectUseCase(asPort())

      await useCase.execute(input('primero'))
      const segundo = await useCase.execute(input('segundo'))

      // La posicion no la manda el cliente: pedirla invita a enviar una ya
      // ocupada, y el unico sitio sensato para algo nuevo es el final.
      expect(segundo.position).toBe(1)
    })

    it('rechaza un id repetido', async () => {
      const useCase = new CreateProjectUseCase(asPort())

      await useCase.execute(input('api-rest'))

      await expect(useCase.execute(input('api-rest'))).rejects.toThrow(DuplicateSlugError)
    })

    it('propaga el error de dominio cuando el contenido es invalido', async () => {
      const useCase = new CreateProjectUseCase(asPort())

      await expect(useCase.execute({ ...input('api-rest'), links: {} })).rejects.toThrow(
        InvalidContentError,
      )
    })

    it('deja el proyecto guardado', async () => {
      await new CreateProjectUseCase(asPort()).execute(input('api-rest'))

      expect(await repository.findById('api-rest')).not.toBeNull()
    })
  })

  describe('editar', () => {
    beforeEach(async () => {
      await repository.save(project('api-rest', 0))
    })

    it('aplica el cambio y lo guarda', async () => {
      const updated = await new UpdateProjectUseCase(asPort()).execute('api-rest', {
        title: { es: 'Nuevo', en: 'New' },
      })

      expect(updated.title.get('es')).toBe('Nuevo')
      expect((await repository.findById('api-rest'))?.title.get('es')).toBe('Nuevo')
    })

    it('ignora un intento de cambiar el id', async () => {
      // El id es la identidad y es ancla de URL en el front: cambiarlo seria
      // borrar y crear, y romperia los enlaces existentes.
      const updated = await new UpdateProjectUseCase(asPort()).execute('api-rest', {
        id: 'otro-id',
      })

      expect(updated.id.value).toBe('api-rest')
      expect(await repository.findById('otro-id')).toBeNull()
    })

    it('ignora un intento de cambiar la position', async () => {
      // Mover se hace con `reorder`, que puede mantener la lista coherente.
      const updated = await new UpdateProjectUseCase(asPort()).execute('api-rest', { position: 7 })

      expect(updated.position).toBe(0)
    })

    it('lanza NotFoundError si no existe', async () => {
      await expect(
        new UpdateProjectUseCase(asPort()).execute('fantasma', { icon: '🚀' }),
      ).rejects.toThrow(NotFoundError)
    })

    it('rechaza un cambio que viola una regla de dominio', async () => {
      await expect(
        new UpdateProjectUseCase(asPort()).execute('api-rest', { tags: [] }),
      ).rejects.toThrow(InvalidContentError)
    })
  })

  describe('borrar', () => {
    beforeEach(async () => {
      await repository.saveAll([project('a', 0), project('b', 1), project('c', 2)])
    })

    it('un admin puede borrar', async () => {
      await new DeleteProjectUseCase(asPort()).execute('b', admin)

      expect((await repository.findAll()).map((item) => item.id.value)).toEqual(['a', 'c'])
    })

    it('un editor no puede, y no se borra nada', async () => {
      const useCase = new DeleteProjectUseCase(asPort())

      await expect(useCase.execute('b', editor)).rejects.toThrow(ForbiddenActionError)
      expect(await repository.findAll()).toHaveLength(3)
    })

    it('recompacta las posiciones despues de borrar', async () => {
      // Sin esto quedarian las posiciones 0 y 2, y el siguiente proyecto creado
      // aterrizaria en la 2, que esta ocupada.
      await new DeleteProjectUseCase(asPort()).execute('b', admin)

      expect((await repository.findAll()).map((item) => [item.id.value, item.position])).toEqual([
        ['a', 0],
        ['c', 1],
      ])
    })

    it('lanza NotFoundError si no existe, incluso siendo admin', async () => {
      await expect(new DeleteProjectUseCase(asPort()).execute('fantasma', admin)).rejects.toThrow(
        NotFoundError,
      )
    })

    it('comprueba el permiso ANTES de mirar si existe', async () => {
      // Al reves, un editor podria averiguar que ids existen por la diferencia
      // entre el 403 y el 404.
      await expect(new DeleteProjectUseCase(asPort()).execute('fantasma', editor)).rejects.toThrow(
        ForbiddenActionError,
      )
    })
  })

  describe('reordenar', () => {
    beforeEach(async () => {
      await repository.saveAll([project('a', 0), project('b', 1), project('c', 2)])
      repository.saveAllCalls = 0
    })

    it('reasigna las posiciones segun la lista recibida', async () => {
      const result = await new ReorderProjectsUseCase(asPort()).execute(['c', 'a', 'b'])

      expect(result.map((item) => [item.id.value, item.position])).toEqual([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ])
    })

    it('guarda todo de una sola vez, no uno por uno', async () => {
      // El orden a medias es peor que el orden viejo: si el cuarto save falla,
      // dos proyectos comparten posicion.
      await new ReorderProjectsUseCase(asPort()).execute(['c', 'a', 'b'])

      expect(repository.saveAllCalls).toBe(1)
    })

    it.each([
      ['falta un id', ['a', 'b']],
      ['sobra un id', ['a', 'b', 'c', 'd']],
      ['un id que no existe', ['a', 'b', 'z']],
      ['lista vacia', []],
    ])('rechaza un orden incompleto o ajeno: %s', async (_label, ids) => {
      await expect(new ReorderProjectsUseCase(asPort()).execute(ids)).rejects.toThrow(
        InvalidContentError,
      )
    })

    it('el error dice exactamente que falta y que no existe', async () => {
      await expect(new ReorderProjectsUseCase(asPort()).execute(['a', 'b', 'z'])).rejects.toThrow(
        /Faltan: c.*No existen: z/,
      )
    })

    it('no cambia nada cuando el orden es invalido', async () => {
      await expect(new ReorderProjectsUseCase(asPort()).execute(['a'])).rejects.toThrow()

      expect((await repository.findAll()).map((item) => item.id.value)).toEqual(['a', 'b', 'c'])
    })
  })
})
