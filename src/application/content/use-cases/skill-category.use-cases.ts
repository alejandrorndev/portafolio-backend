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

/**
 * Numera los items en el orden en que llegaron.
 *
 * El dominio exige `position` en cada skill, pero pedirsela al cliente seria
 * pedirle que administre un detalle interno: el orden que quiso es el del array
 * que envio. Sin esto, crear una categoria devolvia 422 aunque el cuerpo fuera
 * perfectamente valido.
 */
function withItemPositions(items: unknown): unknown {
  if (!Array.isArray(items)) return items

  return (items as unknown[]).map((item, index) =>
    typeof item === 'object' && item !== null
      ? { ...(item as Record<string, unknown>), position: index }
      : item,
  )
}

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
    super(repository, 'skill category', (input) =>
      SkillCategory.create({ ...input, items: withItemPositions(input.items) }),
    )
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
