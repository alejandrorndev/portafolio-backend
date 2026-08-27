import {
  DataSource,
  type DeepPartial,
  type EntityManager,
  type EntityTarget,
  type ObjectLiteral,
} from 'typeorm'
import type { IOrderedRepository } from '@/domain/ports'

/** Lo minimo que el repositorio necesita saber traducir. */
export interface OrmMapper<D, O extends ObjectLiteral> {
  toDomain(row: O): D
  toOrm(entity: D): DeepPartial<O>
}

/*
 * -----------------------------------------------------------------------------
 * Base de los repositorios de colecciones ordenables.
 * -----------------------------------------------------------------------------
 * Proyectos y experiencia se guardan igual: una tabla plana con `position`. La
 * unica diferencia entre sus repositorios seria el nombre de la entidad y el
 * mapper, asi que duplicar el archivo solo duplicaria los sitios donde arreglar
 * un bug.
 *
 * Las categorias de skills NO usan esta base: su agregado incluye los items, que
 * son filas de otra tabla, y guardarlas exige mas que un `save`.
 *
 * Las consultas van por QueryBuilder y no por `find({ order })`: con un tipo
 * generico, `FindOptionsOrder<O>` obliga a un cast que solo sirve para callar al
 * compilador. Escrito asi, el SQL que sale esta a la vista.
 * -----------------------------------------------------------------------------
 */
export abstract class TypeOrmOrderedRepository<
  D,
  O extends ObjectLiteral,
> implements IOrderedRepository<D> {
  protected constructor(
    protected readonly dataSource: DataSource,
    private readonly target: EntityTarget<O>,
    private readonly mapper: OrmMapper<D, O>,
  ) {}

  async findAll(): Promise<D[]> {
    const rows = await this.dataSource
      .getRepository(this.target)
      .createQueryBuilder('entity')
      // Sin este ORDER BY, Postgres devuelve las filas en el orden que le
      // convenga y el portafolio se reordena solo entre despliegues.
      .orderBy('entity.position', 'ASC')
      .getMany()

    return rows.map((row) => this.mapper.toDomain(row))
  }

  async findById(id: string): Promise<D | null> {
    const row = await this.dataSource
      .getRepository(this.target)
      .createQueryBuilder('entity')
      .where('entity.id = :id', { id })
      .getOne()

    return row === null ? null : this.mapper.toDomain(row)
  }

  async save(entity: D): Promise<void> {
    await this.dataSource.getRepository(this.target).save(this.mapper.toOrm(entity))
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.getRepository(this.target).delete(id)
  }

  /**
   * Guarda varias en una transaccion.
   *
   * Es lo que hace posible reordenar: la UNIQUE de `position` es DEFERRABLE
   * INITIALLY DEFERRED, asi que dentro de la transaccion dos filas pueden
   * compartir posicion un instante y Postgres solo se queja en el COMMIT, cuando
   * el orden ya volvio a ser coherente. Fuera de una transaccion, el primer
   * UPDATE fallaria.
   */
  async saveAll(entities: readonly D[]): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      for (const entity of entities) {
        await manager.getRepository(this.target).save(this.mapper.toOrm(entity))
      }
    })
  }
}
