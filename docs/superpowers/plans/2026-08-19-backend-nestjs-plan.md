# Backend del portafolio — plan de implementación

**Diseño:** [`../specs/2026-08-19-backend-nestjs-design.md`](../specs/2026-08-19-backend-nestjs-design.md)
**Fecha:** 2026-08-19
**Estimación:** 8 etapas, ~2.5 semanas de trabajo efectivo

---

## Orden y por qué

Las etapas van **de adentro hacia afuera**: dominio, persistencia, casos de uso,
HTTP, seed, deploy. No es preferencia estética, es la única secuencia en la que
cada etapa se puede probar por completo antes de que exista la siguiente. El
dominio no depende de nada, así que se puede terminar y verificar sin base de
datos ni servidor; los casos de uso solo dependen de puertos, que son interfaces.
Si se empezara por los controllers, no habría forma de probarlos sin mockear todo
lo que aún no existe.

La única excepción es la Etapa 0, que existe para que `pnpm verify` funcione desde
el primer commit y no al final.

| Etapa | Depende de | Estimación |
| --- | --- | --- |
| 0 · Andamiaje | — | 0.5 día |
| 1 · Dominio | 0 | 2 días |
| 2 · Persistencia | 1 | 2 días |
| 3 · Casos de uso de contenido | 1 | 2 días |
| 4 · Auth, roles y usuarios | 1, 2 | 2 días |
| 5 · Capa HTTP | 3, 4 | 2 días |
| 6 · Seed y contrato con el front | 5 | 1 día |
| 7 · Deploy y operación | 6 | 1 día |

Cada etapa termina con un commit que pasa `pnpm verify`. Ninguna etapa se
considera hecha con tests en rojo o cobertura por debajo del 95%.

---

## Etapa 0 — Andamiaje

**Objetivo:** un proyecto vacío que ya obliga a la calidad que el diseño exige.

1. `nest new . --package-manager pnpm --strict`, Node 22 en `engines`.
2. TypeScript en `strict`, con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
   Sin `any` implícitos.
3. ESLint + Prettier + Husky + `lint-staged` + `commitlint` con
   `config-conventional`, replicando la configuración del front para que los dos
   repositorios se sientan igual.
4. Jest con `coverageThreshold` global al 95% en `branches`, `functions`, `lines`
   y `statements`. **Se configura ahora, no al final**: una puerta de cobertura
   que se añade sobre código ya escrito siempre se negocia hacia abajo.
5. Script `verify` = `typecheck && lint && format:check && test`, igual que el front.
6. `docker-compose.yml` con Postgres 17 para desarrollo local.
7. `ConfigModule` con validación de variables al arrancar (zod, como el front): si
   falta una, el proceso muere nombrándola.
8. `HealthModule` con `GET /health` (sin base de datos) y `GET /health/db`.
9. `.env.example` documentando cada variable, y README con los comandos.

**Verificación:** `pnpm verify` verde. `docker compose up -d` y `pnpm start:dev`
responden 200 en `/health`. Un `.env` sin `DATABASE_URL` impide arrancar con un
mensaje claro.

---

## Etapa 1 — Dominio

**Objetivo:** todas las reglas de negocio, probadas, sin una línea de framework.

Se escribe con tests primero. En esta capa es fácil y vale la pena: son funciones
puras y los tests son la especificación ejecutable de las reglas del §3 y §4 del
diseño.

1. **Value objects**, cada uno con su test:
   - `Localized<T>` — rechaza construcción con idiomas faltantes (`InvalidContentError`).
     Es la regla central del sistema (§3.1) y merece el test más exhaustivo.
   - `Slug` — kebab-case, misma expresión regular que el front.
   - `HexColor` — `#` más 6 dígitos hexadecimales.
   - `Accent` — solo `purple`, `cyan`, `pink`, `gold`.
   - `Period` — `end` nulo significa "en curso"; expone `isCurrent`.
   - `ProjectLinks` — al menos uno de `demo` o `github`, ambos `https`.
   - `Role` — `admin` o `editor`, con `canDelete()` y `canManageUsers()`.
   - `Email` — normaliza a minúsculas.
2. **Entidades**: `Project`, `ExperienceItem`, `SkillCategory` (con `SkillItem`),
   `Profile`, `User`. Clases puras, sin decoradores.
3. **Errores**: `DomainError` base y `NotFoundError`, `DuplicateSlugError`,
   `InvalidContentError`, `ForbiddenActionError`, `EmailAlreadyUsedError`,
   `LastAdminError`. Cada uno con un `code` estable (`PROJECT_NOT_FOUND`).
4. **Puertos**: `IProjectRepository`, `IExperienceRepository`,
   `ISkillCategoryRepository`, `IProfileRepository`, `IUserRepository`,
   `ITokenService`, `IHasher`, con sus tokens de inyección.
5. **Test de arquitectura** (`test/architecture.spec.ts`): recorre `src/domain/`
   y falla si algún archivo importa `@nestjs/*`, `typeorm`, `class-validator` o
   cualquier cosa de `infrastructure/` o `interface/`. El front hace lo mismo con
   ESLint y lo documenta así: las reglas las hace cumplir la herramienta, no la
   disciplina. Sin este test, la regla de dependencia se degrada en silencio en
   el primer día con prisa.

**Verificación:** tests del dominio verdes, cobertura de `src/domain/` al 100%
(es alcanzable sin esfuerzo porque no hay I/O), y el test de arquitectura falla
si se agrega a propósito un `import { Injectable } from '@nestjs/common'` en una
entidad.

---

## Etapa 2 — Persistencia

**Objetivo:** los puertos del dominio implementados contra Postgres real.

1. **Entidades TypeORM** en `infrastructure/database/orm/`, separadas de las del
   dominio, con `synchronize: false` en el `data-source`.
2. **Migración inicial** con todo el §4: tablas `profile`, `projects`,
   `experience`, `skill_categories`, `skill_items`, `icon_catalog`, `users`; los
   `CHECK` de slug, hex, `https`, acento y rol; el `CHECK (link_demo IS NOT NULL
   OR link_github IS NOT NULL)`; el `CHECK (id = 'singleton')` del perfil; el
   índice único sobre `lower(email)`; los índices de `position`.
3. **Mappers** ORM ⇄ dominio, uno por agregado, con test de ida y vuelta: mapear
   a ORM y volver debe devolver una entidad equivalente. Es el test que atrapa el
   campo que alguien olvidó agregar al mapper al añadir una columna.
4. **Repositorios** implementando los puertos. Todas las lecturas de listas con
   `ORDER BY position`.
5. Conexión por el pooler cuando `DATABASE_URL` lo indique, con `max: 5`.

**Verificación:** `migration:run` y `migration:revert` limpios sobre una base
vacía. Tests de repositorios contra el Postgres de docker compose. Un `INSERT`
manual de un proyecto sin ningún enlace es rechazado por la base de datos, no por
la aplicación — eso prueba que el `CHECK` existe de verdad.

---

## Etapa 3 — Casos de uso de contenido

**Objetivo:** la orquestación, con los puertos mockeados y sin SQL a la vista.

1. Por cada agregado (proyectos, experiencia, skills, perfil): `list`, `get`,
   `create`, `update`, `delete`, `reorder`. El perfil solo tiene `get` y `update`.
2. `create` valida unicidad de slug y lanza `DuplicateSlugError`; `get` y `update`
   lanzan `NotFoundError`.
3. `reorder` recibe la lista completa de ids y reasigna `position` **en una
   transacción**. Si la lista no contiene exactamente los ids existentes, lanza
   `InvalidContentError`: reordenar con un id de más o de menos es un error del
   cliente, no una invitación a adivinar.
4. `delete` recibe el rol del actor y lanza `ForbiddenActionError` si no es
   `admin` (§6.1, autorización en dos niveles).
5. Los items de skills se editan dentro de su categoría: agregar, quitar y
   reordenar items son operaciones del agregado `SkillCategory`, no de una entidad
   suelta.

**Verificación:** tests con puertos mockeados cubriendo el camino feliz y cada
error de dominio. Cero dependencias de TypeORM en `src/application/` — lo verifica
el test de arquitectura de la Etapa 1, extendido a esta capa.

---

## Etapa 4 — Auth, roles y usuarios

**Objetivo:** la matriz de permisos del §6.1, cumplida y probada.

1. `BcryptHasher` (coste 12) y `JwtTokenService` implementando sus puertos.
2. Casos de uso: `login` (401 si no existe, si la contraseña falla o si
   `is_active` es falso), `verifyToken`, `getCurrentUser`.
3. Casos de uso de usuarios: `listUsers`, `createUser` (`EmailAlreadyUsedError`),
   `updateUser`, `changePassword`, `deleteUser`. Los cuatro últimos exigen rol
   `admin`.
4. **`LastAdminError`**: `updateUser` y `deleteUser` verifican que no se quede el
   sistema sin ningún `admin` activo. Es el invariante que evita el bloqueo total.
5. `ensureBootstrapAdmin`, en el arranque: crea el primer `admin` desde
   `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` **solo si no existe ninguno**.
   Idempotente y con log explícito de lo que hizo o no hizo.
6. `JwtAuthGuard`, `RolesGuard` y el decorador `@Roles()`. El guard **deniega
   cuando la ruta no declara roles**; el test que lo prueba es tan importante como
   el que prueba que un `editor` no borra.
7. `@nestjs/throttler` en el login: 5 por minuto por IP.

**Verificación:** la matriz de §6.1 como test parametrizado — cada combinación de
rol y operación con su resultado esperado. Tests explícitos de: `editor` recibe
403 en cualquier `delete`; `editor` recibe 403 en usuarios; borrar el último admin
da `LastAdminError`; un usuario desactivado no puede entrar; el guard sin `@Roles`
deniega.

---

## Etapa 5 — Capa HTTP

**Objetivo:** la API que consume el mundo, con las formas exactas del §5.

1. Versionado con prefijo `/v1`. CORS desde `CORS_ORIGINS`.
2. **Controllers públicos**: perfil, proyectos, experiencia, skills. `?locale`
   validado por DTO (400 si no es `es` ni `en`).
3. **Controllers de admin**: CRUD y `reorder` de los cuatro agregados, más
   usuarios. **Las rutas estáticas se declaran antes que las paramétricas**:
   `@Patch('reorder')` va antes de `@Patch(':id')`, o Nest resolverá `/reorder`
   como un id.
4. **DTOs** con `class-validator`, replicando las reglas del front, y
   `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`:
   un campo desconocido en el cuerpo es un 400, no un dato que se ignora.
5. **Presenters**: forma resuelta a un idioma para lo público —incluyendo
   `gradient` como tupla, `links` como objeto y el `isCurrent` derivado— y forma
   bilingüe para admin.
6. **`DomainErrorFilter`** global con el mapeo del §6.2 y cuerpo
   `{ statusCode, code, message, details? }`.
7. `Cache-Control` y `ETag` en los `GET` públicos.
8. **Swagger** en `/docs` con `express-basic-auth`, y el esquema `bearerAuth`
   declarado para poder ejecutar las escrituras desde la UI. Documentación de cada
   endpoint según la skill `api-documentation`.

**Verificación:** e2e con Supertest sobre la app completa: login, CRUD de un
proyecto de punta a punta, 401 sin token, 403 con `editor`, 400 con `locale=fr`,
404 con id inexistente, 409 con slug duplicado. `/docs` pide usuario y contraseña.

---

## Etapa 6 — Seed y contrato con el front

**Objetivo:** la base de datos con el contenido real, y la garantía de que la API
habla el idioma del front.

1. `pnpm seed:icons` — importa los nombres de `icons.generated.ts` del front a
   `icon_catalog`.
2. `pnpm seed` — carga el contenido actual: 1 perfil (3 redes, 4 stats), 6
   proyectos, 4 experiencias, 4 categorías con 28 skills. **Invoca los casos de
   uso, no `INSERT`**: así el contenido importado pasa por los mismos invariantes
   que el creado por API, y el seed es la primera prueba de integración real.
3. Idempotente: correrlo dos veces no duplica ni falla.
4. **Test de contrato**: compara la respuesta de los cinco `GET` públicos con las
   formas que exporta `@/content` del front, en `es` y en `en`. Es lo que hace
   posible la Fase 5 y sin él la divergencia aparecería el día de conectar.

**Verificación:** base vacía → `seed:icons` → `seed` → los `GET` devuelven el
portafolio completo en los dos idiomas. Segunda corrida sin cambios ni errores.

---

## Etapa 7 — Deploy y operación

**Objetivo:** en internet, gratis, sin tarjeta.

1. **Dockerfile** multi-stage sobre `node:22-alpine`: etapa de build con dev
   dependencies, etapa final solo con producción y usuario no root. Escucha en
   `PORT`.
2. **Entrypoint** que corre migraciones antes de arrancar Nest (Render no da
   *pre-deploy command* en el plan free, y con una instancia no hay carrera).
3. **Supabase**: proyecto nuevo, cadena del pooler (puerto 6543).
4. **Render**: web service free desde el Dockerfile, variables de entorno,
   auto-deploy en `main`. Primer login con el admin del bootstrap.
5. **CI** en GitHub Actions: `lint`, `typecheck`, tests con la puerta al 95% y
   build del Docker, con un `services: postgres` para los tests de infraestructura
   y e2e.
6. **Dos cron** de GitHub Actions: cada 12 minutos a `/health`, diario a
   `/health/db`. El segundo es el que evita que Supabase pause el proyecto a los 7
   días — su ausencia es una caída silenciosa.
7. Cambiar la contraseña del admin por API y verificar que el hash de la variable
   ya no se aplica.

**Verificación:** los nueve criterios de aceptación del §10 del diseño, uno por
uno. Especialmente el noveno: en ningún proveedor quedó registrada una tarjeta.

---

## Riesgos de ejecución

| Riesgo | Cómo se maneja |
| --- | --- |
| La cobertura al 95% se vuelve una carga en la capa HTTP | Los presenters y filtros son puros y fáciles de probar; el volumen real de tests está en dominio y aplicación, que son los baratos. Si algo queda difícil de cubrir, suele ser señal de que hace demasiado |
| El seed depende de archivos de otro repositorio (`../portafoliov1`) | El contenido se copia a `infrastructure/database/seed/data/` en la Etapa 6, no se importa por ruta relativa. Un backend que no compila si mueves la carpeta del front sería un acoplamiento absurdo |
| Etapa 7 revela un límite del free tier no previsto | El diseño no es específico de Render: es un contenedor con `DATABASE_URL`. El plan B documentado es Koyeb (scale-to-zero) o Vercel serverless |
| Los tests e2e con Postgres real hacen lento el CI | Se separan: `test:unit` en cada push, `test:e2e` también pero con el service container, que en GitHub Actions arranca en segundos |

---

## Definición de terminado

La Fase 1 está lista cuando un `curl` a la URL pública devuelve el portafolio
completo en `es` y en `en`, un `admin` puede editarlo desde Swagger, un `editor`
puede editar pero no borrar, y el gasto acumulado es \$0.
