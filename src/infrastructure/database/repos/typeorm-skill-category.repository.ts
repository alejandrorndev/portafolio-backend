import { Injectable } from '@nestjs/common'
import { DataSource, type EntityManager } from 'typeorm'
import type { SkillCategory } from '@/domain/entities'
import type { ISkillCategoryRepository } from '@/domain/ports'
import { SkillCategoryMapper } from '@/infrastructure/database/mappers'
import { SkillCategoryOrmEntity, SkillItemOrmEntity } from '@/infrastructure/database/orm'

/*
 * -----------------------------------------------------------------------------
 * Las categorias de skills no caben en el repositorio generico.
 * -----------------------------------------------------------------------------
 * El agregado incluye sus items, que viven en otra tabla. Guardar una categoria
 * es entonces guardar la fila, insertar o actualizar sus items y BORRAR los que
 * ya no estan — todo en una transaccion.
 *
 * Sin ese borrado, quitar un skill desde el panel no lo quitaria de la base de
 * datos: la lista guardada solo crece y el skill "eliminado" reaparece en la
 * siguiente lectura.
 * -----------------------------------------------------------------------------
 */
@Injectable()
export class TypeOrmSkillCategoryRepository implements ISkillCategoryRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(): Promise<SkillCategory[]> {
    const rows = await this.dataSource.getRepository(SkillCategoryOrmEntity).find({
      relations: { items: true },
      order: { position: 'ASC', items: { position: 'ASC' } },
    })

    return rows.map((row) => SkillCategoryMapper.toDomain(row))
  }

  async findById(id: string): Promise<SkillCategory | null> {
    const row = await this.dataSource.getRepository(SkillCategoryOrmEntity).findOne({
      where: { id },
      relations: { items: true },
      order: { items: { position: 'ASC' } },
    })

    return row === null ? null : SkillCategoryMapper.toDomain(row)
  }

  async save(category: SkillCategory): Promise<void> {
    await this.dataSource.transaction((manager) => this.persist(manager, category))
  }

  async delete(id: string): Promise<void> {
    // Los items caen con ella: la FK es ON DELETE CASCADE.
    await this.dataSource.getRepository(SkillCategoryOrmEntity).delete(id)
  }

  async saveAll(categories: readonly SkillCategory[]): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      for (const category of categories) {
        await this.persist(manager, category)
      }
    })
  }

  private async persist(manager: EntityManager, category: SkillCategory): Promise<void> {
    await manager.getRepository(SkillCategoryOrmEntity).save(SkillCategoryMapper.toOrm(category))

    const items = SkillCategoryMapper.itemsToOrm(category)
    /*
     * `keptIds` nunca esta vacio: el dominio no permite una categoria sin
     * skills, asi que no hace falta un caso especial para la lista vacia — y
     * escribirlo seria una rama que ningun test puede alcanzar.
     */
    const keptIds = items.map((item) => item.id as string)

    // Primero se borran los que sobran y despues se guardan los actuales: al
    // reves, un item que cambio de posicion chocaria con el que la ocupaba.
    const itemsRepo = manager.getRepository(SkillItemOrmEntity)

    await itemsRepo
      .createQueryBuilder()
      .delete()
      .where('category_id = :categoryId', { categoryId: category.id.value })
      .andWhere('id NOT IN (:...keptIds)', { keptIds })
      .execute()

    await itemsRepo.save(items)
  }
}
