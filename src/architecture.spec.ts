import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
 * -----------------------------------------------------------------------------
 * La regla de dependencia, verificada.
 * -----------------------------------------------------------------------------
 * El diseño dice `interface → application → domain ← infrastructure`. ESLint lo
 * hace cumplir mientras se escribe, pero una regla de ESLint puede dejar de
 * aplicarse sin que nadie lo note: basta un `files:` mal escrito al reorganizar
 * la configuracion para que el dominio quede libre de importar TypeORM.
 *
 * Este archivo comprueba las dos cosas por separado:
 *
 *   1. Que el codigo de hoy respeta las capas (lectura directa de los imports).
 *   2. Que la configuracion de ESLint SIGUE rechazando lo que debe rechazar,
 *      corriendola contra los `__fixtures__` que violan cada regla a proposito.
 *
 * El segundo es el que evita que el primero se vuelva decorativo.
 * -----------------------------------------------------------------------------
 */

const SRC = __dirname
const ROOT = join(SRC, '..')

function filesUnder(directory: string): string[] {
  const found: string[] = []

  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)

      if (statSync(path).isDirectory()) {
        // Los fixtures violan las reglas a proposito: no son codigo del sistema.
        if (entry !== '__fixtures__') walk(path)
        continue
      }

      if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) found.push(path)
    }
  }

  walk(join(SRC, directory))

  return found
}

function violations(layer: string, forbidden: readonly RegExp[]): string[] {
  return filesUnder(layer).flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const imported = [...source.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1] as string,
    )

    return imported
      .filter((module) => forbidden.some((pattern) => pattern.test(module)))
      .map((module) => `${file.replace(ROOT, '').replace(/\\/g, '/')} importa ${module}`)
  })
}

describe('regla de dependencia entre capas', () => {
  it('el dominio no conoce el framework, la persistencia ni las capas exteriores', () => {
    expect(
      violations('domain', [
        /^@nestjs\//,
        /^typeorm$/,
        /^pg$/,
        /^class-validator$/,
        /^class-transformer$/,
        /^@\/(application|infrastructure|interface)\//,
      ]),
    ).toEqual([])
  })

  it('la aplicacion solo depende del dominio', () => {
    // @nestjs/common se tolera: es la concesion documentada para @Injectable e
    // @Inject. Lo que no puede aparecer es TypeORM ni una capa exterior.
    expect(
      violations('application', [
        /^typeorm$/,
        /^pg$/,
        /^@nestjs\/typeorm$/,
        /^@\/(infrastructure|interface)\//,
      ]),
    ).toEqual([])
  })

  it('un controller no toca la base de datos', () => {
    expect(
      violations('interface', [/^typeorm$/, /^pg$/, /^@\/infrastructure\/database\//]),
    ).toEqual([])
  })
})

describe('ESLint sigue rechazando lo que debe rechazar', () => {
  interface LintResult {
    filePath: string
    messages: { ruleId: string | null }[]
  }

  /*
   * Se invoca el CLI en un proceso aparte en vez de la API de ESLint: ESLint 10
   * carga su configuracion con `import()` dinamico, y eso dentro del VM de Jest
   * exige --experimental-vm-modules. Un proceso hijo evita el problema y ademas
   * ejecuta exactamente el mismo binario que corre `pnpm lint`.
   *
   * Una sola invocacion para todos los fixtures: son ~2 segundos que no vale la
   * pena multiplicar por cinco.
   */
  let results: LintResult[] = []

  beforeAll(() => {
    const args = [
      join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
      '--no-ignore',
      '--format',
      'json',
      'src/domain/__fixtures__',
      'src/application/__fixtures__',
      'src/interface/__fixtures__',
    ]

    try {
      results = JSON.parse(
        execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }),
      ) as LintResult[]
    } catch (error) {
      // ESLint sale con codigo 1 cuando encuentra errores, que es justo lo que
      // se espera aqui: el JSON viene en stdout igual.
      const stdout = (error as { stdout?: string }).stdout

      if (stdout === undefined) throw error

      results = JSON.parse(stdout) as LintResult[]
    }
  }, 60_000)

  const rulesFor = (fixture: string): string[] => {
    const normalized = fixture.replace(/\//g, '\\')
    const result = results.find((candidate) => candidate.filePath.includes(normalized))

    if (result === undefined) {
      throw new Error(`ESLint no reporto nada sobre ${fixture}; ¿se movio el fixture?`)
    }

    return result.messages.map((message) => message.ruleId ?? 'sin-regla')
  }

  it.each([
    ['@nestjs en el dominio', 'src/domain/__fixtures__/imports-nestjs.ts'],
    ['typeorm en el dominio', 'src/domain/__fixtures__/imports-typeorm.ts'],
    ['infraestructura en la aplicacion', 'src/application/__fixtures__/imports-infrastructure.ts'],
    ['la base de datos en un controller', 'src/interface/__fixtures__/imports-database.ts'],
  ])('rechaza %s', (_label, fixture) => {
    expect(rulesFor(fixture)).toContain('no-restricted-imports')
  })

  it('no rechaza un import legitimo, para que la regla no sea un muro ciego', () => {
    expect(rulesFor('src/application/__fixtures__/imports-domain-ok.ts')).not.toContain(
      'no-restricted-imports',
    )
  })
})
