import { Inject, Injectable } from '@nestjs/common'
import { Project, type ProjectInput } from '@/domain/entities'
import { PROJECT_REPOSITORY, type IProjectRepository } from '@/domain/ports'
import {
  CreateOrderedUseCase,
  DeleteOrderedUseCase,
  GetOrderedUseCase,
  ListOrderedUseCase,
  ReorderOrderedUseCase,
  UpdateOrderedUseCase,
} from './ordered-content.usecase'

/*
 * Cada clase ata la logica generica a ESTE agregado: su repositorio, su nombre de
 * recurso (el que sale en `PROJECT_NOT_FOUND`) y su fabrica de entidades.
 *
 * Son seis lineas cada una a proposito. Si alguna crece, es señal de que los
 * proyectos dejaron de comportarse como una coleccion ordenada mas y les toca su
 * propio caso de uso.
 */

/** Input de creacion: sin `position`, que la asigna el caso de uso. */
export type CreateProjectInput = Omit<ProjectInput, 'position'>

@Injectable()
export class ListProjectsUseCase extends ListOrderedUseCase<Project> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository)
  }
}

@Injectable()
export class GetProjectUseCase extends GetOrderedUseCase<Project> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository, 'project')
  }
}

@Injectable()
export class CreateProjectUseCase extends CreateOrderedUseCase<Project, CreateProjectInput> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository, 'project', (input) => Project.create(input))
  }
}

@Injectable()
export class UpdateProjectUseCase extends UpdateOrderedUseCase<Project, ProjectInput> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository, 'project')
  }
}

@Injectable()
export class DeleteProjectUseCase extends DeleteOrderedUseCase<Project> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository, 'project')
  }
}

@Injectable()
export class ReorderProjectsUseCase extends ReorderOrderedUseCase<Project> {
  constructor(@Inject(PROJECT_REPOSITORY) repository: IProjectRepository) {
    super(repository, 'projects')
  }
}
