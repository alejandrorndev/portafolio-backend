import { InvalidContentError } from '@/domain/errors'

/**
 * Enlaces de un proyecto.
 *
 * Al menos uno es obligatorio, y la razon esta en el contenido del front: una
 * tarjeta de proyecto sin ningun enlace no le sirve a nadie, porque es justo lo
 * que un reclutador va a querer abrir.
 *
 * Solo https: un enlace http en una pagina servida por https lo bloquea el
 * navegador, y el visitante ve un boton que no hace nada.
 */
export class ProjectLinks {
  private constructor(
    readonly demo: string | null,
    readonly github: string | null,
  ) {}

  static of(input: unknown, field = 'links'): ProjectLinks {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new InvalidContentError(`${field}: se esperaba un objeto con demo y/o github`)
    }

    const source = input as Record<string, unknown>

    return ProjectLinks.fromColumns(source['demo'] ?? null, source['github'] ?? null, field)
  }

  static fromColumns(demo: unknown, github: unknown, field = 'links'): ProjectLinks {
    const parsed = {
      demo: ProjectLinks.parseOptionalUrl(demo, `${field}.demo`),
      github: ProjectLinks.parseOptionalUrl(github, `${field}.github`),
    }

    if (parsed.demo === null && parsed.github === null) {
      throw new InvalidContentError(`${field}: un proyecto necesita al menos un enlace`)
    }

    return new ProjectLinks(parsed.demo, parsed.github)
  }

  private static parseOptionalUrl(value: unknown, field: string): string | null {
    if (value === null || value === undefined || value === '') return null

    if (typeof value !== 'string') {
      throw new InvalidContentError(`${field}: se esperaba una URL`)
    }

    if (!value.startsWith('https://')) {
      throw new InvalidContentError(`${field}: "${value}" debe usar https`)
    }

    return value
  }

  /** Forma del front: claves ausentes en lugar de nulos. */
  toJSON(): { demo?: string; github?: string } {
    return {
      ...(this.demo !== null ? { demo: this.demo } : {}),
      ...(this.github !== null ? { github: this.github } : {}),
    }
  }
}
