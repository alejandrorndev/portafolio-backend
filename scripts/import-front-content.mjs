/*
 * -----------------------------------------------------------------------------
 * Importa el contenido del front a JSON.
 * -----------------------------------------------------------------------------
 * Genera `src/infrastructure/database/seed/data/*.json` a partir de los archivos
 * de `../portafoliov1/src/content/`. Ese JSON se commitea, y es lo que lee el
 * seed: asi el backend NO depende de la ruta del front en tiempo de ejecucion.
 * Mover o borrar la carpeta del front no puede romper un despliegue.
 *
 * Este script es la unica pieza que cruza la frontera entre los dos proyectos, y
 * solo se ejecuta a mano cuando el contenido del front cambia — igual que
 * `pnpm icons` en el front.
 *
 * Los archivos de contenido solo importan TIPOS, asi que transpilarlos borra los
 * imports y queda un modulo de datos puros que se puede evaluar. Es mas fiable
 * que parsear TypeScript con expresiones regulares.
 *
 *   pnpm import:front            usa ../portafoliov1
 *   pnpm import:front <ruta>     usa otra ruta
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FRONT = resolve(ROOT, process.argv[2] ?? '../portafoliov1')
const OUT = join(ROOT, 'src/infrastructure/database/seed/data')

/** Evalua un archivo de datos del front y devuelve su export nombrado. */
function importData(relativePath, exportName) {
  const source = readFileSync(join(FRONT, relativePath), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })

  const module = { exports: {} }
  // El modulo transpilado no tiene imports en runtime: los de tipos desaparecen.
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)

  const value = module.exports[exportName]

  if (value === undefined) {
    throw new Error(`${relativePath} no exporta "${exportName}"`)
  }

  return value
}

/** Los nombres de icono disponibles, del tipo generado por `pnpm icons`. */
function importIconNames() {
  const source = readFileSync(join(FRONT, 'src/shared/ui/icons.generated.ts'), 'utf8')
  const names = [...source.matchAll(/\|\s*'([^']+)'/g)].map((match) => match[1])

  if (names.length === 0) {
    throw new Error('No se encontro ningun nombre de icono en icons.generated.ts')
  }

  return names.sort()
}

const write = (name, data) => {
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  const count = Array.isArray(data) ? `${data.length} elementos` : 'objeto'
  console.log(`  ${name}.json  (${count})`)
}

mkdirSync(OUT, { recursive: true })

console.log(`Importando contenido de ${FRONT}`)

write('profile', importData('src/content/profile.ts', 'profile'))
write('projects', importData('src/content/projects.ts', 'projects'))
write('experience', importData('src/content/experience.ts', 'experience'))
write('skills', importData('src/content/skills.ts', 'skillCategories'))
write('icons', importIconNames())

console.log('\nListo. Revisa el diff antes de commitear: este JSON es la fuente del seed.')
