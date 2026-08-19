/**
 * Conventional Commits, la misma convencion del repositorio del front.
 *
 * Los scopes salen de las capas y los modulos del diseño, no de las secciones
 * de una pagina: aqui "que parte del sistema toca" significa otra cosa.
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'domain',
        'application',
        'infrastructure',
        'interface',
        'auth',
        'users',
        'content',
        'db',
        'seed',
        'health',
        'docs',
        'ci',
        'deps',
        'config',
      ],
    ],
  },
}

export default config
