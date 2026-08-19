/**
 * Puerto de comprobacion de la base de datos.
 *
 * El chequeo de salud no es una regla de negocio, pero si es una dependencia
 * externa, y el puerto existe por la misma razon que los demas: la capa que
 * responde `/health/db` no tiene por que saber si detras hay Postgres, un
 * `SELECT 1` o un ping de otra clase.
 */
export interface IDatabaseProbe {
  /** `true` si la base de datos responde ahora mismo. */
  isReachable(): Promise<boolean>
}

/** Token de inyeccion. Es un string y no un simbolo para que aparezca legible
 *  en los errores del contenedor cuando falta un proveedor. */
export const DATABASE_PROBE = 'IDatabaseProbe'
