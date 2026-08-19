import { z } from 'zod'

/*
 * -----------------------------------------------------------------------------
 * Las variables de entorno se validan al arrancar.
 * -----------------------------------------------------------------------------
 * Un backend que arranca a medias y falla en la primera peticion es peor que uno
 * que no arranca: el error aparece lejos de su causa, en produccion, con un
 * usuario esperando. Aqui un `DATABASE_URL` ausente mata el proceso nombrando la
 * variable que falta.
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

  DATABASE_URL: z.string().min(1, 'Falta la cadena de conexion a Postgres'),

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
