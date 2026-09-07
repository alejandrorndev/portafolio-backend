import { DuplicateSlugError, InvalidContentError } from '@/domain/errors'

/*
 * -----------------------------------------------------------------------------
 * De error de Postgres a error de dominio.
 * -----------------------------------------------------------------------------
 * La base de datos hace cumplir reglas que la aplicacion tambien conoce: el
 * catalogo de iconos, los CHECK del contenido, la unicidad de los ids. Cuando la
 * que las hace cumplir es la base —porque el dato entro por un camino que el
 * dominio no vio, o porque dos peticiones corrieron a la vez— lo que llega es un
 * `QueryFailedError` del driver.
 *
 * Sin traducirlo, ese error sale como 500 y con el volcado completo de Postgres
 * en los logs. Y un 500 es una mentira: el servidor funciona perfectamente, lo
 * que estaba mal era la peticion. Traducirlo aqui —en la capa que conoce
 * Postgres— es lo que permite que el resto del sistema siga hablando solo de
 * errores de dominio.
 *
 * Es la contraparte de `DomainErrorFilter`: uno traduce hacia HTTP, este traduce
 * desde el driver.
 * -----------------------------------------------------------------------------
 */

/** Codigos de error de Postgres que sabemos interpretar. */
const FOREIGN_KEY_VIOLATION = '23503'
const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'
const NOT_NULL_VIOLATION = '23502'

interface DriverError {
  code?: string
  constraint?: string
  detail?: string
  column?: string
  table?: string
}

/** Lo que el driver de Postgres pone en la excepcion, si es que la puso. */
function driverErrorOf(error: unknown): DriverError | null {
  if (typeof error !== 'object' || error === null) return null

  const candidate = error as { driverError?: unknown; code?: unknown }
  const source = (candidate.driverError ?? candidate) as DriverError

  return typeof source.code === 'string' ? source : null
}

/**
 * Mensajes que explican QUE hacer, no que constraint fallo.
 *
 * "FK_skill_items_icon" no le dice nada a quien esta editando su portafolio desde
 * Swagger; "ese icono no existe en el catalogo" si.
 */
const MESSAGES: Record<string, string> = {
  FK_skill_items_icon:
    'El icono no existe en el catalogo. Los iconos disponibles son los que el front tiene ' +
    'vendorizados (pnpm import:front los sincroniza).',
  FK_skill_items_category: 'La categoria de skills indicada no existe.',
  CHK_projects_one_link: 'Un proyecto necesita al menos un enlace: demo o github.',
  CHK_projects_tags: 'Un proyecto necesita al menos un tag.',
  CHK_experience_stack: 'Una experiencia necesita al menos una tecnologia en el stack.',
  UQ_users_email_lower: 'Ese correo ya esta registrado.',
}

/**
 * Traduce el error del driver, o lo vuelve a lanzar tal cual.
 *
 * Lo que no reconocemos se propaga sin tocar: un fallo de conexion o un error de
 * sintaxis SQL SI son problemas del servidor, y convertirlos en un 4xx los
 * esconderia.
 */
export function translateDatabaseError(error: unknown): never {
  const driver = driverErrorOf(error)

  if (driver === null) throw error

  const constraint = driver.constraint ?? ''
  const explanation = MESSAGES[constraint]

  switch (driver.code) {
    case FOREIGN_KEY_VIOLATION:
      throw new InvalidContentError(
        explanation ?? `Referencia inexistente (${constraint || 'clave ajena'}).`,
      )

    case UNIQUE_VIOLATION:
      if (explanation !== undefined) throw new InvalidContentError(explanation)

      // Sin nombre de recurso a mano, el mensaje del error de dominio lo compone
      // con lo que hay: el constraint dice cual es el duplicado.
      throw new DuplicateSlugError('registro', constraint || 'desconocido')

    case CHECK_VIOLATION:
      throw new InvalidContentError(
        explanation ?? `El dato no cumple una regla de la base de datos (${constraint}).`,
      )

    case NOT_NULL_VIOLATION:
      throw new InvalidContentError(
        `Falta un campo obligatorio${driver.column === undefined ? '' : `: ${driver.column}`}.`,
      )

    default:
      throw error
  }
}

/** Envuelve una escritura para que sus fallos salgan como errores de dominio. */
export async function translatingErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    translateDatabaseError(error)
  }
}
