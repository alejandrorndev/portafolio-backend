import type { IOrderedRepository } from '@/domain/ports'

/*
 * Repositorio en memoria para los tests de casos de uso.
 *
 * No es un mock de jest con expectativas sobre llamadas: es una implementacion
 * de verdad del puerto, mas simple. La diferencia importa — un mock verifica que
 * se llamo a `saveAll`, y esto verifica que el ORDEN quedo bien, que es lo que
 * de verdad se quiere saber.
 *
 * `saveAll` no simula transaccion: en produccion la da Postgres, y los tests de
 * `test/repositories.e2e-spec.ts` la comprueban ahi.
 */
export class FakeOrderedRepository<
  T extends { id: { value: string }; position: number },
> implements IOrderedRepository<T> {
  private items: T[] = []

  /** Cuantas veces se guardo en lote: delata un reordenamiento sin transaccion. */
  saveAllCalls = 0

  constructor(initial: T[] = []) {
    this.items = [...initial]
  }

  async findAll(): Promise<T[]> {
    return [...this.items].sort((a, b) => a.position - b.position)
  }

  async findById(id: string): Promise<T | null> {
    return this.items.find((item) => item.id.value === id) ?? null
  }

  async save(entity: T): Promise<void> {
    const index = this.items.findIndex((item) => item.id.value === entity.id.value)

    if (index === -1) this.items.push(entity)
    else this.items[index] = entity
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id.value !== id)
  }

  async saveAll(entities: readonly T[]): Promise<void> {
    this.saveAllCalls += 1

    for (const entity of entities) {
      await this.save(entity)
    }
  }
}
