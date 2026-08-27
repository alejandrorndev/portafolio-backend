import { z } from 'zod'

/*
 * -----------------------------------------------------------------------------
 * Las variables de entorno se validan al arrancar.
 * -----------------------------------------------------------------------------
 * Un backend que arranca a medias y falla en la primera peticion es peor que uno
 * que no arranca: el error aparece lejos de su causa, en produccion, con un
 * usuario esperando. Aqui una variable ausente mata el proceso nombrandola.
 *
 * El esquema crece por etapas. Solo se exige lo que el codigo ya usa: pedir
 * JWT_SECRET antes de que exista autenticacion obligaria a inventar un valor de
 * relleno, y un valor de relleno en una variable de seguridad tiende a
 * sobrevivir hasta produccion.
 * -----------------------------------------------------------------------------
 */

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Lo inyecta el host (Render); en local cae al valor por defecto. */
  PORT: z.coerce.number().int().positive().default(3001),

  /*
   * --- Postgres -------------------------------------------------------------
   * En variables separadas y no en una sola URL: es lo que ya hay declarado en
   * el entorno de desarrollo, y una URL obliga a escapar la contraseña cuando
   * lleva caracteres especiales — un fallo que se manifiesta como
   * "authentication failed" sin decir por que.
   *
   * En produccion (Supabase) se rellenan con los datos del POOLER, no de la
   * conexion directa.
   */
  DB_HOST: z.string().min(1, 'Falta el host de Postgres'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USERNAME: z.string().min(1, 'Falta el usuario de Postgres'),
  DB_PASSWORD: z.string().min(1, 'Falta la contraseña de Postgres'),
  DB_DATABASE_NAME: z.string().min(1, 'Falta el nombre de la base de datos'),

  /**
   * Base de datos que usan los tests de integracion.
   *
   * Existe por seguridad, no por comodidad: el helper de los tests recrea el
   * esquema desde cero (`DROP SCHEMA public CASCADE`), y la instancia de
   * desarrollo puede alojar otras bases. Apuntar los tests a la base de trabajo
   * la borraria.
   */
  DB_DATABASE_NAME_TEST: z.string().min(1).default('portafolio_test'),

  /**
   * Origenes permitidos, separados por coma. Vacio significa "ninguno", no
   * "todos": un CORS abierto por omision es la clase de descuido que nadie
   * revisa despues.
   */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
})

export type Env = z.infer<typeof envSchema>

/** Valida el entorno o explica exactamente que falta y muere. */
export function validateEnv(source: Record<string, unknown>): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n')

    throw new Error(`Configuracion invalida:\n${problems}`)
  }

  return result.data
}
