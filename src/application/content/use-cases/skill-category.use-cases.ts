import { Inject, Injectable } from '@nestjs/common'
import { SkillCategory, type SkillCategoryInput } from '@/domain/entities'
import { SKILL_CATEGORY_REPOSITORY, type ISkillCategoryRepository } from '@/domain/ports'
import {
  CreateOrderedUseCase,
  DeleteOrderedUseCase,
  GetOrderedUseCase,
  ListOrderedUseCase,
  ReorderOrderedUseCase,
  UpdateOrderedUseCase,
} from './ordered-content.usecase'

export type CreateSkillCategoryInput = Omit<SkillCategoryInput, 'position'>

@Injectable()
export class ListSkillCategoriesUseCase extends ListOrderedUseCase<SkillCategory> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository)
  }
}

@Injectable()
export class GetSkillCategoryUseCase extends GetOrderedUseCase<SkillCategory> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository, 'skill category')
  }
}

@Injectable()
export class CreateSkillCategoryUseCase extends CreateOrderedUseCase<
  SkillCategory,
  CreateSkillCategoryInput
> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository, 'skill category', (input) => SkillCategory.create(input))
  }
}

@Injectable()
export class UpdateSkillCategoryUseCase extends UpdateOrderedUseCase<
  SkillCategory,
  SkillCategoryInput
> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository, 'skill category')
  }
}

@Injectable()
export class DeleteSkillCategoryUseCase extends DeleteOrderedUseCase<SkillCategory> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository, 'skill category')
  }
}

@Injectable()
export class ReorderSkillCategoriesUseCase extends ReorderOrderedUseCase<SkillCategory> {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository, 'skill categories')
  }
}
