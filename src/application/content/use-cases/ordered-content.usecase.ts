import { DuplicateSlugError, InvalidContentError, NotFoundError } from '@/domain/errors'
import type { User } from '@/domain/entities'
import type { IOrderedRepository } from '@/domain/ports'

/*
 * -----------------------------------------------------------------------------
 * Casos de uso de una coleccion ordenada.
 * -----------------------------------------------------------------------------
 * Proyectos, experiencia y categorias de skills se administran igual: listar,
 * leer, crear al final, editar, borrar recompactando el orden y reordenar. La
 * unica diferencia entre los tres es la entidad y el repositorio.
 *
 * Escribir dieciocho clases con el mismo cuerpo no las haria mas explicitas:
 * haria que un bug de orden viviera en tres sitios. Estas clases contienen la
 * logica una vez, y cada agregado la ata a su repositorio con una subclase de
 * seis lineas (`project.use-cases.ts` y compañia).
 *
 * Ninguna lanza excepciones HTTP: lanzan errores de dominio, y el filtro de la
 * capa interface los traduce. Asi el mismo caso de uso sirve al seed y a un
 * script, donde un 404 no significa nada.
 * -----------------------------------------------------------------------------
 */

/** Lo que una entidad ordenable tiene que saber hacer. */
export interface Ordered {
  readonly id: { readonly value: string }
  readonly position: number
}

export interface OrderedEntity<T extends Ordered> extends Ordered {
  withPosition(position: number): T
}

/** Lo que una entidad editable tiene que saber hacer. */
export interface Patchable<T, I> {
  patch(changes: Partial<I>): T
}

export abstract class ListOrderedUseCase<T extends Ordered> {
  protected constructor(protected readonly repository: IOrderedRepository<T>) {}

  /** Ya vienen ordenadas por `position`: el orden es del repositorio. */
  async execute(): Promise<T[]> {
    return this.repository.findAll()
  }
}

export abstract class GetOrderedUseCase<T extends Ordered> {
  protected constructor(
    protected readonly repository: IOrderedRepository<T>,
    private readonly resource: string,
  ) {}

  async execute(id: string): Promise<T> {
    const found = await this.repository.findById(id)

    if (found === null) throw new NotFoundError(this.resource, id)

    return found
  }
}

export abstract class CreateOrderedUseCase<T extends Ordered, I> {
  protected constructor(
    protected readonly repository: IOrderedRepository<T>,
    private readonly resource: string,
    private readonly factory: (input: I & { position: number }) => T,
  ) {}

  /**
   * Crea al final de la lista.
   *
   * La posicion no se recibe: pedirla al cliente invita a mandar una que ya esta
   * ocupada, y el unico sitio sensato para algo nuevo es el final. Moverlo es
   * trabajo de `reorder`.
   */
  async execute(input: I & { id: unknown }): Promise<T> {
    const existing = await this.repository.findAll()
    const id = String(input.id)

    if (existing.some((item) => item.id.value === id)) {
      throw new DuplicateSlugError(this.resource, id)
    }

    const created = this.factory({ ...input, position: existing.length })

    await this.repository.save(created)

    return created
  }
}

export abstract class UpdateOrderedUseCase<T extends Ordered & Patchable<T, I>, I> {
  protected constructor(
    protected readonly repository: IOrderedRepository<T>,
    private readonly resource: string,
  ) {}

  /**
   * Edita sin permitir mover ni renombrar.
   *
   * `id` y `position` se descartan del cambio a proposito: el id es la identidad
   * —cambiarlo es borrar y crear, y romperia los enlaces del front— y la posicion
   * se administra con `reorder`, que puede mantener la lista coherente.
   */
  async execute(id: string, changes: Partial<I>): Promise<T> {
    const current = await this.repository.findById(id)

    if (current === null) throw new NotFoundError(this.resource, id)

    const {
      id: _id,
      position: _position,
      ...safe
    } = changes as Partial<I> & {
      id?: unknown
      position?: unknown
    }

    const updated = current.patch(safe as Partial<I>)

    await this.repository.save(updated)

    return updated
  }
}

export abstract class DeleteOrderedUseCase<T extends OrderedEntity<T>> {
  protected constructor(
    protected readonly repository: IOrderedRepository<T>,
    private readonly resource: string,
  ) {}

  /**
   * Borra y recompacta el orden.
   *
   * El actor entra como parametro porque el permiso de borrado es una regla de
   * negocio, no del transporte: el guard de HTTP ya devolvio 403, pero este mismo
   * caso de uso puede invocarse desde un script donde no hay ningun guard.
   */
  async execute(id: string, actor: User): Promise<void> {
    actor.ensureCanDeleteContent(`borrar ${this.resource}`)

    const current = await this.repository.findById(id)

    if (current === null) throw new NotFoundError(this.resource, id)

    await this.repository.delete(id)

    // Sin esto, borrar el segundo de tres deja las posiciones 0 y 2, y el
    // siguiente elemento creado aterriza en la 2, ocupada.
    const remaining = await this.repository.findAll()

    await this.repository.saveAll(remaining.map((item, index) => item.withPosition(index)))
  }
}

export abstract class ReorderOrderedUseCase<T extends OrderedEntity<T>> {
  protected constructor(
    protected readonly repository: IOrderedRepository<T>,
    private readonly resource: string,
  ) {}

  /**
   * Reasigna las posiciones segun la lista de ids recibida.
   *
   * Exige la lista COMPLETA. Recibir un id de mas o de menos es un error del
   * cliente, no una invitacion a adivinar donde va lo que falta — y adivinar
   * dejaria el orden distinto del que el editor vio en pantalla.
   */
  async execute(orderedIds: readonly string[]): Promise<T[]> {
    const current = await this.repository.findAll()
    const currentIds = current.map((item) => item.id.value)

    const missing = currentIds.filter((id) => !orderedIds.includes(id))
    const unexpected = orderedIds.filter((id) => !currentIds.includes(id))

    if (orderedIds.length !== currentIds.length || missing.length > 0 || unexpected.length > 0) {
      throw new InvalidContentError(
        `El orden de ${this.resource} debe incluir exactamente los elementos existentes` +
          (missing.length > 0 ? `. Faltan: ${missing.join(', ')}` : '') +
          (unexpected.length > 0 ? `. No existen: ${unexpected.join(', ')}` : ''),
      )
    }

    const byId = new Map(current.map((item) => [item.id.value, item]))
    const reordered = orderedIds.map((id, index) => (byId.get(id) as T).withPosition(index))

    // Una sola transaccion: seis `save` sueltos dejarian el orden a medias si
    // algo falla en el cuarto.
    await this.repository.saveAll(reordered)

    return reordered
  }
}
