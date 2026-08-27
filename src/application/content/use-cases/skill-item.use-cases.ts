import { Inject, Injectable } from '@nestjs/common'
import type { Actor, SkillCategory } from '@/domain/entities'
import { NotFoundError } from '@/domain/errors'
import { SKILL_CATEGORY_REPOSITORY, type ISkillCategoryRepository } from '@/domain/ports'

/*
 * -----------------------------------------------------------------------------
 * Los skills se editan a traves de su categoria.
 * -----------------------------------------------------------------------------
 * Un skill no existe por si solo: "NestJS" sin la categoria "Backend" no tiene
 * donde renderizarse. Por eso estos casos de uso cargan la categoria, le piden el
 * cambio al agregado —que es quien conoce las reglas: no quedarse sin items,
 * recompactar posiciones— y la guardan completa.
 *
 * Un repositorio de items sueltos permitiria dejar un skill huerfano, o vaciar
 * una categoria sin que nadie lo impidiera.
 * -----------------------------------------------------------------------------
 */

abstract class SkillItemUseCase {
  protected constructor(protected readonly repository: ISkillCategoryRepository) {}

  protected async load(categoryId: string): Promise<SkillCategory> {
    const category = await this.repository.findById(categoryId)

    if (category === null) throw new NotFoundError('skill category', categoryId)

    return category
  }
}

@Injectable()
export class AddSkillItemUseCase extends SkillItemUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository)
  }

  async execute(
    categoryId: string,
    item: { name: unknown; icon: unknown },
  ): Promise<SkillCategory> {
    const updated = (await this.load(categoryId)).addItem(item)

    await this.repository.save(updated)

    return updated
  }
}

@Injectable()
export class RemoveSkillItemUseCase extends SkillItemUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository)
  }

  /**
   * Quitar un skill es borrar contenido, asi que pide rol de admin — la misma
   * regla que borrar un proyecto entero, por la misma razon: no hay historial
   * que lo recupere.
   */
  async execute(categoryId: string, itemId: string, actor: Actor): Promise<SkillCategory> {
    actor.ensureCanDeleteContent('quitar un skill')

    const updated = (await this.load(categoryId)).removeItem(itemId)

    await this.repository.save(updated)

    return updated
  }
}

@Injectable()
export class ReorderSkillItemsUseCase extends SkillItemUseCase {
  constructor(@Inject(SKILL_CATEGORY_REPOSITORY) repository: ISkillCategoryRepository) {
    super(repository)
  }

  async execute(categoryId: string, orderedIds: readonly string[]): Promise<SkillCategory> {
    const updated = (await this.load(categoryId)).reorderItems(orderedIds)

    await this.repository.save(updated)

    return updated
  }
}
