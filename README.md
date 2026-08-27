# Portafolio — backend

API del portafolio de Alejandro Restrepo Naranjo. Expone el contenido del sitio
—perfil, proyectos, experiencia y skills— para poder administrarlo sin editar
código ni esperar un deploy.

El front vive en [`../portafoliov1`](../portafoliov1) y **no depende todavía de esta
API**: la conexión es una fase aparte.

- Diseño: [`docs/superpowers/specs/2026-08-19-backend-nestjs-design.md`](docs/superpowers/specs/2026-08-19-backend-nestjs-design.md)
- Plan de implementación: [`docs/superpowers/plans/2026-08-19-backend-nestjs-plan.md`](docs/superpowers/plans/2026-08-19-backend-nestjs-plan.md)

## Stack

NestJS 11 · TypeScript strict · TypeORM + PostgreSQL 17 · Jest

## Requisitos

- Node.js >= 22
- pnpm 11
- PostgreSQL 16 accesible (una instancia local propia, o el `docker-compose.yml`
  de este repositorio)

## Arrancar

```bash
pnpm install
cp .env.example .env          # y ajustar las variables DB_* a tu Postgres
pnpm migration:run            # crea el esquema
pnpm start:dev                # API en localhost:3001
```

Con el servidor arriba:

| URL                             | Qué es                              |
| ------------------------------- | ----------------------------------- |
| http://localhost:3001/docs      | Swagger UI                          |
| http://localhost:3001/docs-json | El OpenAPI en crudo                 |
| http://localhost:3001/health    | Chequeo de vida (sin base de datos) |
| http://localhost:3001/health/db | Chequeo de la base de datos         |

Si el 3001 está ocupado, `PORT=3005 pnpm start:dev`.

**Swagger solo se monta fuera de producción.** En producción esta página es el
panel de administración provisional y tiene que ir detrás de basic auth (Etapa
5); hasta que ese candado exista, no se publica.

## Comandos

| Comando                 | Qué hace                                     |
| ----------------------- | -------------------------------------------- |
| `pnpm start:dev`        | Servidor en modo watch                       |
| `pnpm build`            | Compila a `dist/`                            |
| `pnpm verify`           | Tipos + lint + formato + tests con cobertura |
| `pnpm test`             | Tests unitarios                              |
| `pnpm test:e2e`         | Tests end to end (requieren Postgres arriba) |
| `pnpm db:up`            | Levanta Postgres                             |
| `pnpm db:down`          | Lo baja                                      |
| `pnpm migration:run`    | Aplica las migraciones pendientes            |
| `pnpm migration:revert` | Revierte la última                           |
| `pnpm migration:show`   | Qué migraciones hay y cuáles corrieron       |

`pnpm verify` es exactamente lo que corre CI. Si pasa en local, pasa allá.

**La cobertura al 95% se mide sobre los tests unitarios**, que no tocan la base de
datos. Los repositorios de TypeORM quedan fuera de esa puerta a propósito: lo único
que tienen es SQL, y probarlos con un `DataSource` mockeado sería afirmar que la
consulta que se escribió es la que se escribió. Su garantía son los tests de
`pnpm test:e2e`, que corren contra un Postgres real — CI corre las dos suites.

## Arquitectura

Clean Architecture, con una única dirección de dependencia:

```
interface  ──▶  application  ──▶  domain  ◀──  infrastructure
```

```
src/
├── domain/           Entidades, value objects, puertos y errores. Sin framework.
├── application/      Casos de uso. Orquestan el dominio a través de puertos.
├── infrastructure/   TypeORM, configuración, seguridad y los módulos de Nest.
└── interface/http/   Controllers, DTOs, presenters, guards y filtros.
```

**Estas reglas las hace cumplir ESLint, no la disciplina.** El dominio no puede
importar `@nestjs/*` ni `typeorm`; la aplicación no puede importar
`infrastructure/`; un controller no puede tocar la base de datos. Violarlo es un
error de lint, no una observación en code review.

## Los dos chequeos de salud

No son redundantes y la diferencia es deliberada:

| Endpoint     | Consulta la BD | Para qué                                                               |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| `/health`    | No             | Keepalive cada 12 min, para que el host no duerma el servicio          |
| `/health/db` | Sí             | Chequeo diario, para que el proveedor de Postgres no pause el proyecto |

Si `/health` consultara la base de datos, mantendría la conexión viva de forma
permanente y con algunos proveedores eso consume la cuota mensual de cómputo.

## Variables de entorno

Copiar `.env.example` a `.env`. Si falta una obligatoria, el proceso **no arranca**
y dice cuál — un backend que arranca a medias y falla en la primera petición es
peor que uno que no arranca.

| Variable                | Obligatoria | Para qué                                              |
| ----------------------- | ----------- | ----------------------------------------------------- |
| `DB_HOST`               | Sí          | Host de Postgres                                      |
| `DB_PORT`               | No          | 5432 por defecto                                      |
| `DB_USERNAME`           | Sí          | Usuario                                               |
| `DB_PASSWORD`           | Sí          | Contraseña                                            |
| `DB_DATABASE_NAME`      | Sí          | Base de datos de la aplicación                        |
| `DB_DATABASE_NAME_TEST` | No          | Base de los tests. `portafolio_test` por defecto      |
| `NODE_ENV`              | No          | `development` por defecto                             |
| `PORT`                  | No          | 3001 en local, para no chocar con el front en el 3000 |
| `CORS_ORIGINS`          | No          | Orígenes permitidos. Vacío significa **ninguno**      |

En variables separadas y no en una sola URL de conexión: es lo que ya hay
declarado en el entorno de desarrollo, y una URL obliga a escapar la contraseña
cuando lleva caracteres especiales — un fallo que se manifiesta como
`authentication failed` sin decir por qué.

### La base de datos de los tests es OTRA, y es obligatorio que lo sea

`pnpm test:e2e` ejecuta `DROP SCHEMA public CASCADE` antes de correr, porque
prueba el esquema que produce la migración real. Una instancia de Postgres de una
máquina de trabajo suele alojar decenas de bases, así que apuntar los tests a la
equivocada no sería un test que falla: sería una base de datos perdida.

Por eso `DB_DATABASE_NAME_TEST` **tiene que terminar en `_test`** y ser distinta
de `DB_DATABASE_NAME`; si no, los tests se niegan a arrancar. La base la crean
ellos mismos si no existe.

## La API

Prefijo `/v1`. La lectura es pública; escribir exige un token.

| Recurso     | Público                       | Admin                                                                                   |
| ----------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| Perfil      | `GET /v1/profile`             | `GET` · `PUT /v1/admin/profile`                                                         |
| Proyectos   | `GET /v1/projects` · `/:id`   | `GET` · `POST` · `PUT /:id` · `DELETE /:id` · `PATCH /reorder`                          |
| Experiencia | `GET /v1/experience` · `/:id` | igual que proyectos                                                                     |
| Skills      | `GET /v1/skills`              | igual, más `POST /:id/items` · `DELETE /:id/items/:itemId` · `PATCH /:id/items/reorder` |
| Sesión      | —                             | `POST /v1/auth/login` · `GET /v1/auth/me`                                               |
| Usuarios    | —                             | `GET` · `POST` · `PATCH /:id` · `PUT /:id/password` · `DELETE /:id`                     |

Los `GET` públicos aceptan `?locale=es|en` y devuelven **texto ya resuelto**, con la
forma exacta que exporta `@/content` en el front — por eso conectarlo será reescribir
un solo archivo. Los `GET` de `/admin` devuelven el objeto **bilingüe** completo, que
es lo que necesita quien edita.

Un `locale` que no existe es un **400**, no un idioma por defecto silencioso: si
alguien pide `fr`, la respuesta correcta es decirle que no existe.

### Los errores tienen una sola forma

```json
{ "statusCode": 422, "code": "INVALID_CONTENT", "message": "...", "details": ["..."] }
```

`code` es estable y pensado para que el panel reaccione sin parsear mensajes en
español. `details` aparece solo cuando hay una lista de problemas concretos, que es
lo que un formulario necesita para señalar el campo equivocado.

| Código                                                   | Cuándo                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| 400 `VALIDATION_FAILED`                                  | La petición está mal formada — lo detecta el DTO     |
| 401 `UNAUTHORIZED`                                       | Sin token, token inválido o credenciales incorrectas |
| 403 `FORBIDDEN_ACTION`                                   | El rol no alcanza                                    |
| 404 `<RECURSO>_NOT_FOUND`                                | El id no existe                                      |
| 409 `DUPLICATE_ID` · `LAST_ADMIN` · `EMAIL_ALREADY_USED` | Conflicto con el estado actual                       |
| 422 `INVALID_CONTENT`                                    | La petición es válida pero el dominio no la acepta   |
| 429 `TOO_MANY_REQUESTS`                                  | Demasiados intentos de login                         |

La distinción entre 400 y 422 es deliberada: **400 es "tu petición está mal
formada"** y **422 es "tu petición es válida pero el dominio no la acepta"**. Un
consumidor puede distinguir entre corregir la forma y corregir el significado.

## El contenido inicial

```bash
pnpm import:front   # ../portafoliov1 → src/infrastructure/database/seed/data/*.json
pnpm seed           # carga ese JSON; correrlo dos veces no duplica nada
```

El seed lee **JSON commiteado**, no el repositorio del front: un backend que no se
puede sembrar porque alguien movió una carpeta ajena sería un acoplamiento absurdo
entre dos proyectos que se despliegan por separado. `import:front` es la única pieza
que cruza esa frontera, y se ejecuta a mano.

Y siembra invocando los **casos de uso**, no con `INSERT`: así el contenido
importado pasa por los mismos invariantes que el creado por API.

## Roles

Dos roles, y una sola asimetría entre ellos:

| Acción                   | anónimo | `editor` | `admin` |
| ------------------------ | ------- | -------- | ------- |
| Lectura pública          | ✔       | ✔        | ✔       |
| Crear y editar contenido | ✘       | ✔        | ✔       |
| Reordenar                | ✘       | ✔        | ✔       |
| **Borrar** contenido     | ✘       | ✘        | ✔       |
| Administrar usuarios     | ✘       | ✘        | ✔       |

Crear y editar son reversibles —se corrige el texto y listo—, pero borrar destruye
contenido bilingüe que costó escribir y no hay historial que lo recupere. Esa es la
razón de que `DELETE` sea la línea divisoria.

Tres decisiones que conviene conocer antes de tocar esta parte:

- **El `RolesGuard` deniega si la ruta no declara `@Roles(...)`.** Falla cerrado: un
  guard que permite por omisión convierte un olvido en un endpoint abierto.
- **Siempre queda al menos un `admin` activo.** Borrarlo, degradarlo o desactivarlo
  lanza `LastAdminError`. Sin esa regla, un clic deja el sistema inadministrable.
- **La autorización no consulta la base de datos.** El token lleva `{ sub, email,
role }` y de ahí sale el `Actor`. La contrapartida: degradar a alguien tarda
  hasta 8 horas en surtir efecto. Para cortar el acceso al instante, rotar
  `JWT_SECRET` invalida todos los tokens.

### El primer administrador

Un despliegue nuevo tiene la base vacía, así que no habría con qué autenticarse
para crear el primer usuario. Al arrancar, si no existe ningún admin activo, se
crea uno desde `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` (`pnpm secrets` los genera).

Es idempotente y **no pisa nada**: con un admin ya existente no hace nada, ni
siquiera si el hash de la variable cambió. Por eso la contraseña se cambia por API
y no editando el entorno.

## Estado

| Etapa | Descripción                  | Estado |
| ----- | ---------------------------- | ------ |
| 0     | Andamiaje                    | ✅     |
| 1     | Dominio                      | ✅     |
| 2     | Persistencia                 | ✅     |
| 3     | Casos de uso de contenido    | ✅     |
| 4     | Auth, roles y usuarios       | ✅     |
| 5     | Capa HTTP                    | ✅     |
| 6     | Seed y contrato con el front | ✅     |
| 7     | Deploy y operación           | ⬜     |
