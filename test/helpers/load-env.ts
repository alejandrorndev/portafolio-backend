import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/*
 * -----------------------------------------------------------------------------
 * Carga el .env antes de los tests de integracion.
 * -----------------------------------------------------------------------------
 * Sin esto los tests corren con el entorno vacio y caen a los valores por
 * defecto del helper. Eso ya paso: coincidian con el contenedor de
 * docker-compose, asi que los tests pasaban apuntando a una base distinta de la
 * configurada y nadie se enteraba hasta cambiar de instancia.
 *
 * El archivo se parsea a mano en vez de usar `process.loadEnvFile` de Node,
 * aunque exista y sea nativo: escribe en el `process.env` del proceso real,
 * mientras cada entorno de Jest trabaja sobre una COPIA del entorno. Desde un
 * setupFile, loadEnvFile no cambia nada de lo que el test ve.
 *
 * Las variables que ya existen en el entorno tienen prioridad, que es lo que
 * hace falta en CI: alli las inyecta el runner, no un archivo.
 * -----------------------------------------------------------------------------
 */
const envPath = join(__dirname, '..', '..', '.env')

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()

    if (trimmed.length === 0 || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')

    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const raw = trimmed.slice(separator + 1).trim()
    const value = raw.replace(/^(['"])(.*)\1$/, '$2')

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
