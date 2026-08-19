import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/*
 * -----------------------------------------------------------------------------
 * La regla de dependencia la hace cumplir el linter, no la disciplina.
 * -----------------------------------------------------------------------------
 * El diseño dice `interface → application → domain ← infrastructure`. Escrito
 * solo en un documento, eso dura hasta el primer dia con prisa: alguien importa
 * un repositorio de TypeORM dentro de un caso de uso porque "es mas rapido" y
 * la arquitectura se degrada sin que nadie lo note en el diff.
 *
 * Aqui violar una capa es un error de lint, no una observacion de code review.
 * `test/architecture.spec.ts` (Etapa 1) verifica que estas reglas sigan
 * rechazando lo que deben rechazar.
 * -----------------------------------------------------------------------------
 */

/** El dominio no conoce ni el framework ni la base de datos. Nada. */
const DOMAIN_FORBIDDEN = [
  { group: ['@nestjs/*'], message: 'El dominio no depende del framework.' },
  { group: ['typeorm', 'pg'], message: 'El dominio no conoce la persistencia.' },
  {
    group: ['class-validator', 'class-transformer'],
    message: 'La validacion de entrada es de la capa interface; el dominio valida en sus VOs.',
  },
  {
    group: ['@/application/*', '@/infrastructure/*', '@/interface/*'],
    message: 'El dominio es el centro: no importa de ninguna capa exterior.',
  },
]

/** La aplicacion tolera @nestjs/common por la DI, pero nada de detalles. */
const APPLICATION_FORBIDDEN = [
  { group: ['typeorm', 'pg'], message: 'Los casos de uso hablan con puertos, no con TypeORM.' },
  {
    group: ['@nestjs/typeorm', '@nestjs/platform-express'],
    message: 'Los casos de uso no conocen la infraestructura.',
  },
  {
    group: ['@/infrastructure/*', '@/interface/*'],
    message: 'La aplicacion solo depende del dominio.',
  },
]

/** Los controllers usan casos de uso; no alcanzan la base de datos. */
const INTERFACE_FORBIDDEN = [
  {
    group: ['typeorm', 'pg', '@/infrastructure/database/*'],
    message: 'Un controller no toca la base de datos: llama a un caso de uso.',
  },
]

export default tseslint.config(
  {
    /*
     * Los `__fixtures__` violan las reglas de capa a proposito: son la carnada
     * de `src/architecture.spec.ts`, que corre ESLint contra ellos con
     * `--no-ignore` y falla si alguno DEJA de ser rechazado. Se ignoran aqui
     * para que `pnpm lint` no reporte las violaciones que existen para ser
     * reportadas.
     */
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/__fixtures__/**'],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          // `const { id: _id, ...resto } = primitivos` es la forma de quitar una
          // clave sin nombrarla dos veces. Marcarla como variable sin usar
          // convierte un patron correcto en un error.
          ignoreRestSiblings: true,
        },
      ],
      // Nest lanza excepciones y devuelve promesas por todas partes; estas dos
      // reglas solo generan ruido en un proyecto de este tipo.
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    files: ['src/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: DOMAIN_FORBIDDEN }] },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: APPLICATION_FORBIDDEN }] },
  },
  {
    files: ['src/interface/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: INTERFACE_FORBIDDEN }] },
  },

  // Los tests pueden hacer cosas que el codigo de produccion no.
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  { files: ['**/*.mjs'], ...tseslint.configs.disableTypeChecked },

  prettier,
)
