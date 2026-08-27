import { Inject, Injectable } from '@nestjs/common'
import { ExperienceItem, type ExperienceItemInput } from '@/domain/entities'
import { EXPERIENCE_REPOSITORY, type IExperienceRepository } from '@/domain/ports'
import {
  CreateOrderedUseCase,
  DeleteOrderedUseCase,
  GetOrderedUseCase,
  ListOrderedUseCase,
  ReorderOrderedUseCase,
  UpdateOrderedUseCase,
} from './ordered-content.usecase'

export type CreateExperienceInput = Omit<ExperienceItemInput, 'position'>

@Injectable()
export class ListExperienceUseCase extends ListOrderedUseCase<ExperienceItem> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository)
  }
}

@Injectable()
export class GetExperienceUseCase extends GetOrderedUseCase<ExperienceItem> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository, 'experience')
  }
}

@Injectable()
export class CreateExperienceUseCase extends CreateOrderedUseCase<
  ExperienceItem,
  CreateExperienceInput
> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository, 'experience', (input) => ExperienceItem.create(input))
  }
}

@Injectable()
export class UpdateExperienceUseCase extends UpdateOrderedUseCase<
  ExperienceItem,
  ExperienceItemInput
> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository, 'experience')
  }
}

@Injectable()
export class DeleteExperienceUseCase extends DeleteOrderedUseCase<ExperienceItem> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository, 'experience')
  }
}

@Injectable()
export class ReorderExperienceUseCase extends ReorderOrderedUseCase<ExperienceItem> {
  constructor(@Inject(EXPERIENCE_REPOSITORY) repository: IExperienceRepository) {
    super(repository, 'experience')
  }
}
