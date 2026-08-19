import { randomUUID } from 'node:crypto'
import { InvalidContentError, NotFoundError } from '@/domain/errors'
import { parseAccent, type Accent } from '@/domain/value-objects/accent'
import { Localized } from '@/domain/value-objects/localized'
import { parseList, parseNonNegativeInteger, parseText } from '@/domain/value-objects/primitives'
import { Slug } from '@/domain/value-objects/slug'

/*
 * `randomUUID` de node:crypto es la unica utilidad externa que el dominio usa.
 * La skill de Clean Architecture lo permite explicitamente para UUIDs, y la
 * alternativa —un puerto IIdGenerator inyectado en cada caso de uso que agregue
 * un skill— es mucha maquinaria para generar un identificador que a nadie le
 * importa cual es.
 */

export interface SkillItemInput {
  id?: unknown
  name: unknown
  icon: unknown
  position: unknown
}

export interface SkillItemPrimitives {
  id: string
  name: string
  icon: string
  position: number
}

/** Un skill dentro de una categoria. Su identidad la asigna el sistema. */
export class SkillItem {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly icon: string,
    readonly position: number,
  ) {}

  static create(input: SkillItemInput): SkillItem {
    return new SkillItem(
      input.id === undefined || input.id === null
        ? randomUUID()
        : parseText(input.id, 'skillItem.id'),
      parseText(input.name, 'skillItem.name'),
      // El icono se valida contra `icon_catalog` en la base de datos: aqui no
      // hay forma de saber que SVG vendorizo el front.
      parseText(input.icon, 'skillItem.icon'),
      parseNonNegativeInteger(input.position, 'skillItem.position'),
    )
  }

  withPosition(position: number): SkillItem {
    return SkillItem.create({ ...this.toPrimitives(), position })
  }

  toPrimitives(): SkillItemPrimitives {
    return { id: this.id, name: this.name, icon: this.icon, position: this.position }
  }
}

export interface SkillCategoryInput {
  id: unknown
  title: unknown
  accent: unknown
  items: unknown
  position: unknown
}

export interface SkillCategoryPrimitives {
  id: string
  title: Record<string, string>
  accent: Accent
  items: SkillItemPrimitives[]
  position: number
}

export class SkillCategory {
  private constructor(
    readonly id: Slug,
    readonly title: Localized<string>,
    readonly accent: Accent,
    readonly items: readonly SkillItem[],
    readonly position: number,
  ) {}

  static create(input: SkillCategoryInput): SkillCategory {
    const items = parseList(input.items, 'skillCategory.items').map((item) =>
      SkillItem.create(item as SkillItemInput),
    )

    return new SkillCategory(
      Slug.of(input.id, 'skillCategory.id'),
      Localized.text(input.title, 'skillCategory.title'),
      parseAccent(input.accent, 'skillCategory.accent'),
      SkillCategory.sorted(items),
      parseNonNegativeInteger(input.position, 'skillCategory.position'),
    )
  }

  addItem(item: Omit<SkillItemInput, 'position'>): SkillCategory {
    const next = SkillItem.create({ ...item, position: this.items.length })

    return this.withItems([...this.items, next])
  }

  removeItem(itemId: string): SkillCategory {
    if (!this.items.some((item) => item.id === itemId)) {
      throw new NotFoundError('skill item', itemId)
    }

    const remaining = this.items.filter((item) => item.id !== itemId)

    if (remaining.length === 0) {
      // Una categoria vacia se renderiza como un titulo suelto sin nada debajo.
      // Si la intencion es que desaparezca, lo correcto es borrar la categoria.
      throw new InvalidContentError(
        'skillCategory.items: una categoria no puede quedarse sin skills',
      )
    }

    return this.withItems(remaining.map((item, index) => item.withPosition(index)))
  }

  /**
   * Reasigna el orden de los items segun la lista de ids recibida.
   *
   * Exige la lista COMPLETA: recibir un id de mas o de menos es un error del
   * cliente, no una invitacion a adivinar donde va lo que falta.
   */
  reorderItems(orderedIds: readonly string[]): SkillCategory {
    const current = this.items.map((item) => item.id)
    const missing = current.filter((id) => !orderedIds.includes(id))
    const unknown = orderedIds.filter((id) => !current.includes(id))

    if (orderedIds.length !== current.length || missing.length > 0 || unknown.length > 0) {
      throw new InvalidContentError(
        'skillCategory.items: el orden debe incluir exactamente los skills existentes',
      )
    }

    const byId = new Map(this.items.map((item) => [item.id, item]))
    const reordered = orderedIds.map((id, index) => {
      // El Map se construyo con los mismos ids que se acaban de validar.
      const item = byId.get(id) as SkillItem

      return item.withPosition(index)
    })

    return this.withItems(reordered)
  }

  patch(changes: Partial<SkillCategoryInput>): SkillCategory {
    return SkillCategory.create({ ...this.toPrimitives(), ...changes })
  }

  withPosition(position: number): SkillCategory {
    return this.patch({ position })
  }

  toPrimitives(): SkillCategoryPrimitives {
    return {
      id: this.id.value,
      title: this.title.toJSON(),
      accent: this.accent,
      items: this.items.map((item) => item.toPrimitives()),
      position: this.position,
    }
  }

  private withItems(items: readonly SkillItem[]): SkillCategory {
    return new SkillCategory(this.id, this.title, this.accent, items, this.position)
  }

  /** El orden de presentacion es el de `position`, no el de llegada. */
  private static sorted(items: readonly SkillItem[]): SkillItem[] {
    return [...items].sort((a, b) => a.position - b.position)
  }
}
