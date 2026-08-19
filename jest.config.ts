import type { Config } from 'jest'

/*
 * -----------------------------------------------------------------------------
 * Dos proyectos, una configuracion.
 * -----------------------------------------------------------------------------
 * Los unitarios corren en cada guardado y no tocan nada externo. Los e2e
 * necesitan un Postgres de verdad, asi que van aparte: separarlos permite que
 * `pnpm test` siga siendo instantaneo cuando la base de datos no esta arriba.
 *
 * La puerta de cobertura se configura ahora, con el proyecto vacio, y no al
 * final. Una puerta añadida sobre codigo ya escrito siempre se negocia hacia
 * abajo; una que estuvo desde el primer commit se cumple sola.
 * -----------------------------------------------------------------------------
 */

const transform = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
} as const

const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
} as const

const config: Config = {
  projects: [
    {
      displayName: 'unit',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
      transform,
      moduleNameMapper,
    },
    {
      displayName: 'e2e',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      transform,
      moduleNameMapper,
    },
  ],

  collectCoverageFrom: [
    'src/**/*.ts',
    // Composicion y declaraciones: no hay ramas que probar, y exigirles
    // cobertura solo produce tests que afirman que un modulo se puede importar.
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/index.ts',
    '!src/infrastructure/database/orm/**',
    // Interfaces mas un token de inyeccion: no hay comportamiento que probar.
    '!src/domain/ports/**',
    // Violan las reglas a proposito: son la carnada del test de arquitectura.
    '!src/**/__fixtures__/**',
    '!src/infrastructure/database/migrations/**',
    '!src/infrastructure/database/data-source.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    global: { branches: 95, functions: 95, lines: 95, statements: 95 },
  },
}

export default config
