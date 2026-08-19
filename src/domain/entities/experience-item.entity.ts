import { parseAccent, type Accent } from '@/domain/value-objects/accent'
import { Localized } from '@/domain/value-objects/localized'
import {
  parseNonNegativeInteger,
  parseText,
  parseTextList,
} from '@/domain/value-objects/primitives'
import { Period } from '@/domain/value-objects/period'
import { Slug } from '@/domain/value-objects/slug'

export interface ExperienceItemInput {
  id: unknown
  period: unknown
  company: unknown
  role: unknown
  description: unknown
  stack: unknown
  accent: unknown
  position: unknown
}

export interface ExperienceItemPrimitives {
  id: string
  period: { start: string; end: string | null }
  company: string
  role: Record<string, string>
  description: Record<string, string>
  stack: string[]
  accent: Accent
  position: number
}

export class ExperienceItem {
  private constructor(
    readonly id: Slug,
    readonly period: Period,
    readonly company: string,
    readonly role: Localized<string>,
    readonly description: Localized<string>,
    readonly stack: readonly string[],
    readonly accent: Accent,
    readonly position: number,
  ) {}

  static create(input: ExperienceItemInput): ExperienceItem {
    return new ExperienceItem(
      Slug.of(input.id, 'experience.id'),
      Period.of(input.period, 'experience.period'),
      parseText(input.company, 'experience.company'),
      Localized.text(input.role, 'experience.role'),
      Localized.text(input.description, 'experience.description'),
      parseTextList(input.stack, 'experience.stack'),
      parseAccent(input.accent, 'experience.accent'),
      parseNonNegativeInteger(input.position, 'experience.position'),
    )
  }

  /** Derivado del periodo, nunca almacenado. */
  get isCurrent(): boolean {
    return this.period.isCurrent
  }

  patch(changes: Partial<ExperienceItemInput>): ExperienceItem {
    return ExperienceItem.create({ ...this.toPrimitives(), ...changes })
  }

  withPosition(position: number): ExperienceItem {
    return this.patch({ position })
  }

  toPrimitives(): ExperienceItemPrimitives {
    return {
      id: this.id.value,
      period: this.period.toJSON(),
      company: this.company,
      role: this.role.toJSON(),
      description: this.description.toJSON(),
      stack: [...this.stack],
      accent: this.accent,
      position: this.position,
    }
  }
}
