import { Gradient } from '@/domain/value-objects/gradient'
import { Localized } from '@/domain/value-objects/localized'
import {
  parseNonNegativeInteger,
  parseText,
  parseTextList,
} from '@/domain/value-objects/primitives'
import { ProjectLinks } from '@/domain/value-objects/project-links'
import { Slug } from '@/domain/value-objects/slug'

/**
 * Todos los campos entran como `unknown` a proposito.
 *
 * Los datos vienen de HTTP o de una fila de base de datos: en los dos casos son
 * externos, y tipearlos como si ya fueran correctos solo trasladaria la mentira
 * al compilador. La entidad valida, y lo que sale de `create` si esta garantizado.
 */
export interface ProjectInput {
  id: unknown
  type: unknown
  title: unknown
  description: unknown
  tags: unknown
  icon: unknown
  gradient: unknown
  links: unknown
  position: unknown
}

export interface ProjectPrimitives {
  id: string
  type: Record<string, string>
  title: Record<string, string>
  description: Record<string, string>
  tags: string[]
  icon: string
  gradient: [string, string]
  links: { demo?: string; github?: string }
  position: number
}

export class Project {
  private constructor(
    readonly id: Slug,
    readonly type: Localized<string>,
    readonly title: Localized<string>,
    readonly description: Localized<string>,
    readonly tags: readonly string[],
    readonly icon: string,
    readonly gradient: Gradient,
    readonly links: ProjectLinks,
    readonly position: number,
  ) {}

  static create(input: ProjectInput): Project {
    return new Project(
      Slug.of(input.id, 'project.id'),
      Localized.text(input.type, 'project.type'),
      Localized.text(input.title, 'project.title'),
      Localized.text(input.description, 'project.description'),
      parseTextList(input.tags, 'project.tags'),
      parseText(input.icon, 'project.icon'),
      Gradient.of(input.gradient, 'project.gradient'),
      ProjectLinks.of(input.links, 'project.links'),
      parseNonNegativeInteger(input.position, 'project.position'),
    )
  }

  /** Devuelve una copia con los campos indicados reemplazados. */
  patch(changes: Partial<ProjectInput>): Project {
    return Project.create({ ...this.toPrimitives(), ...changes })
  }

  withPosition(position: number): Project {
    return this.patch({ position })
  }

  toPrimitives(): ProjectPrimitives {
    return {
      id: this.id.value,
      type: this.type.toJSON(),
      title: this.title.toJSON(),
      description: this.description.toJSON(),
      tags: [...this.tags],
      icon: this.icon,
      gradient: this.gradient.toJSON(),
      links: this.links.toJSON(),
      position: this.position,
    }
  }
}
