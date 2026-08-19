# Backend del portafolio — diseño

**Fecha:** 2026-08-19
**Autor:** Alejandro Restrepo Naranjo
**Estado:** aprobado el diseño de arquitectura (Sección 3); resto pendiente de revisión
**Revisión 2:** se añaden dos roles, `admin` y `editor` (§6.1)

---

## 1. Contexto

El portafolio (`../portafoliov1`) es un Next.js 16 bilingüe cuyo contenido vive en
archivos `.ts` validados con Zod en tiempo de build. Funciona bien, pero cada
corrección de una descripción o cada proyecto nuevo exige editar código, commitear
y esperar un deploy.

Este backend expone ese mismo contenido por API para que pueda administrarse sin
tocar el repositorio del front. El front **no se modifica en esta fase**: el
backend se construye contra los contratos que el front ya define, y la conexión
se decide después.

La costura ya existe y no es casualidad. Ningún componente del front lee los
archivos de datos: todos consumen `getProfile(locale)`, `getProjects(locale)`,
`getExperience(locale)` y `getSkillCategories(locale)` desde `@/content`, y ESLint
prohíbe importar los archivos internos desde fuera de esa carpeta. El día que se
conecte, cambiar de fuente es reescribir `src/content/index.ts` — un archivo — sin
tocar un solo componente. El README del front ya lo anticipaba.

### Restricciones

1. **Coste cero y sin tarjeta de crédito.** No es una preferencia: es un límite
   duro que descarta Railway, Fly.io, Northflank, AWS, GCP, Azure y Oracle Always
   Free (todos exigen tarjeta, incluso cuando el consumo es \$0).
2. **NestJS con Clean Architecture**, según la skill del proyecto: TypeORM,
   `class-validator`, Swagger, Jest con 95% de cobertura mínima.
3. El front queda intacto.

---

## 2. Alcance

### Fase 1 — esta entrega

- API de contenido: perfil, proyectos, experiencia y skills. Lectura pública,
  escritura autenticada.
- Autenticación con dos roles, `admin` y `editor`, y administración de usuarios.
- Seed que importa el contenido actual del front.
- Swagger protegido, que hace de panel de administración provisional.
- Despliegue en internet, gratis y sin tarjeta.

### Fuera de alcance, deliberadamente

| Diferido | Por qué |
| --- | --- |
| Panel admin en Next.js | Fase 2. Swagger alcanza para administrar durante semanas, y construirlo ahora retrasaría el primer deploy útil en dos semanas |
| Mensajes de contacto | Fase 3. El formulario del front ya envía por su propia Server Action; un endpoint aquí no tendría consumidor hasta que el front se conecte |
| Métricas y eventos | Fase 4 |
| Conectar el front a la API | Fase 5, decisión aparte |
| Registro público de usuarios, verificación por email y recuperación de contraseña | Los usuarios los crea el administrador. Un portafolio no tiene visitantes que necesiten cuenta, y esos tres flujos traen envío de correo —que es Fase 3— sin resolver ningún problema de hoy |
| Blog e imágenes | Sin demanda real |

---

## 3. Arquitectura *(aprobada)*

Dependencias en una sola dirección: `interface → application → domain ← infrastructure`.
El dominio no importa nada de `@nestjs/*` ni de `typeorm`.

```
src/
├── domain/
│   ├── entities/          profile, project, experience-item, skill-category, user  (clases puras)
│   ├── value-objects/     localized, slug, accent, hex-color, project-links, period, role, email
│   ├── ports/             i-profile.repository, i-project.repository, i-user.repository,
│   │                      i-token.service, i-hasher
│   └── errors/            domain.error, not-found.error, duplicate-slug.error, invalid-content.error,
│                          forbidden-action.error, email-already-used.error, last-admin.error
├── application/
│   ├── content/use-cases/ get-projects, get-project, create-project, update-project,
│   │                      delete-project, reorder-projects  (y el juego equivalente para
│   │                      profile, experience y skills)
│   ├── auth/use-cases/    login, verify-token, get-current-user
│   └── users/use-cases/   list-users, create-user, update-user, change-password, delete-user,
│                          ensure-bootstrap-admin
├── infrastructure/
│   ├── database/orm/      entidades TypeORM (@Entity) + mappers ORM ⇄ dominio
│   ├── database/repos/    implementaciones de los puertos del dominio
│   ├── database/migrations/ + data-source.ts + seed/
│   ├── config/            validación de variables de entorno al arrancar
│   ├── security/          bcrypt-hasher.service, jwt-token.service
│   └── modules/           content.module, auth.module, users.module, health.module
└── interface/http/
    ├── controllers/       public/ (lectura)  ·  admin/ (escritura y usuarios, con guards)
    ├── dto/               create-project.dto, update-project.dto, localized-text.dto,
    │                      locale-query.dto, login.dto, create-user.dto
    ├── guards/            jwt-auth.guard, roles.guard  +  @Roles() decorator
    ├── presenters/        resolución de idioma y forma de respuesta
    └── filters/           domain-error.filter
```

### 3.1 `Localized<T>` es un value object del dominio

El front resolvió el error más probable de un sitio bilingüe —agregar un proyecto
en español y olvidar el inglés— haciendo que un `Record<Locale, T>` incompleto no
compile. En el backend el compilador ya no protege nada: los datos entran por HTTP
en runtime. Así que ese invariante asciende a regla de dominio: construir un
`Localized` sin todos los idiomas lanza `InvalidContentError`.

No es un detalle de persistencia. Es la regla de negocio central de este sistema.

### 3.2 Entidades de dominio y entidades de TypeORM son archivos distintos

Con mappers entre ellas. Es duplicación deliberada, y es lo que exige la skill de
Clean Architecture: un `@Column` en el dominio ataría el modelo de negocio a
Postgres. El coste es un mapper por agregado; el beneficio es que los casos de uso
y sus tests no saben que existe una base de datos.

### 3.3 Los presenters hacen lo que hoy hace `@/content`

Misma entidad, dos representaciones:

- Los `GET` públicos con `?locale=es` devuelven **texto ya resuelto**, idéntico a lo
  que hoy retornan `getProjects(locale)` y compañía. Eso es lo que hace que
  conectar el front sea reescribir un barrel.
- Los `GET` de admin devuelven el **objeto bilingüe completo**, que es lo que un
  editor necesita.

Esa es exactamente la responsabilidad de un presenter, y evita tener dos entidades
para el mismo concepto.

### 3.4 Validación en dos niveles, a propósito

Los DTOs con `class-validator` replican las reglas del front (slug kebab-case, hex
de 6 dígitos, `https` obligatorio, mínimo un enlace por proyecto) y el dominio las
vuelve a exigir en sus value objects.

Es el mismo razonamiento que el `schema.ts` del front documenta para cliente y
servidor: el DTO es experiencia de uso —falla rápido, con un mensaje claro en el
400— y el dominio es el autoritativo, porque los casos de uso también se invocan
desde el seed y desde los tests, donde no hay ningún DTO que los proteja.

---

## 4. Modelo de datos

Postgres. Los campos traducidos se guardan como `jsonb` con forma `{"es": …, "en": …}`,
espejando el modelo del front en vez de inventar tablas de traducción que nadie pidió.
Las consultas siempre traen el registro completo, así que normalizar por idioma
solo agregaría joins sin comprar nada.

### 4.1 Tablas

**`profile`** — una sola fila, garantizada por una columna `id` de tipo texto fija
en `'singleton'` y un `CHECK (id = 'singleton')`. Es más simple que una tabla de
configuración clave-valor y hace imposible el estado de "dos perfiles".

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `text` PK | siempre `'singleton'` |
| `full_name`, `brand`, `email` | `text` | |
| `display_name` | `jsonb` | `{first, last}` — no es traducible |
| `available` | `boolean` | |
| `location`, `headline`, `role`, `summary` | `jsonb` | `Localized<string>` |
| `bio` | `jsonb` | array de `Localized<string>`, orden significativo |
| `typewriter_roles` | `jsonb` | array de `Localized<string>` |
| `cv` | `jsonb` nullable | `Localized<string>`; `null` mientras no exista el PDF |
| `socials` | `jsonb` | array de `{id, label, href, icon}` |
| `stats` | `jsonb` | array de `{id, value, suffix, labelKey}` |
| `created_at`, `updated_at` | `timestamptz` | |

`socials` y `stats` van como `jsonb` y no como tablas propias porque siempre se
leen y se escriben junto al perfil y nunca se consultan por separado. Ese es el
criterio: si un dato no se consulta ni se ordena de forma independiente, una tabla
solo agrega ceremonia.

**`projects`**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `text` PK | slug kebab-case, `CHECK` con la misma expresión que el front |
| `type`, `title`, `description` | `jsonb` | `Localized<string>` |
| `tags` | `text[]` | nombres de tecnologías, no se traducen |
| `icon` | `text` | emoji |
| `gradient_from`, `gradient_to` | `text` | `CHECK (~ '^#[0-9a-fA-F]{6}$')` |
| `link_demo`, `link_github` | `text` nullable | `CHECK` de prefijo `https://` |
| `position` | `integer` | orden de presentación, único |
| `created_at`, `updated_at` | `timestamptz` | |

Dos decisiones aquí:

- El gradiente y los enlaces se guardan en **columnas separadas, no en `jsonb`**,
  porque tienen reglas que Postgres puede verificar. `CHECK (link_demo IS NOT NULL
  OR link_github IS NOT NULL)` convierte la regla del front —"un proyecto sin
  ningún enlace no le sirve a nadie: es justo lo que un reclutador va a querer
  abrir"— en algo que la base de datos no permite violar, ni desde un seed, ni
  desde una migración, ni desde una consulta manual a las tres de la mañana.
- **`position` es obligatorio.** En el front el orden es el del array; en Postgres
  no hay orden implícito, y un `SELECT` sin `ORDER BY` puede devolver las filas
  como quiera. Sin esta columna el portafolio reordenaría sus proyectos solos.

**`experience`**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `text` PK | slug |
| `period_start` | `text` | etiqueta, no fecha: el front muestra "2024" o "Ene 2024" |
| `period_end` | `text` nullable | `null` significa "en curso" |
| `company` | `text` | |
| `role`, `description` | `jsonb` | `Localized<string>` |
| `stack` | `text[]` | |
| `accent` | `text` | `CHECK IN ('purple','cyan','pink','gold')` |
| `position` | `integer` | único |

`isCurrent` **no se almacena**: se deriva de `period_end IS NULL` en el presenter,
igual que hoy el front lo deriva de `period.end === null`. Un campo booleano
aparte es un campo que se puede desincronizar.

**`skill_categories`** — `id` (slug PK), `title` (`jsonb`), `accent` (`CHECK`),
`position`.

**`skill_items`** — `id` (uuid PK), `category_id` (FK → `skill_categories`,
`ON DELETE CASCADE`), `name`, `icon`, `position`. Aquí sí es tabla y no `jsonb`,
porque los items se editan de a uno y son 28 con crecimiento previsible.

**`users`**

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `email` | `text` UNIQUE | se guarda en minúsculas; el índice único es sobre `lower(email)` |
| `password_hash` | `text` | bcrypt, coste 12 |
| `role` | `text` | `CHECK IN ('admin','editor')` |
| `is_active` | `boolean` | `default true`; desactivar en lugar de borrar preserva la trazabilidad |
| `created_at`, `updated_at` | `timestamptz` | |

El `CHECK` sobre `role` y no un enum de Postgres a propósito: agregar un rol a un
`CHECK` es una migración de una línea, mientras que `ALTER TYPE ... ADD VALUE` no
se puede revertir dentro de una transacción. Con dos roles la diferencia es
teórica; con cuatro deja de serlo.

**`icon_catalog`** — `name` (`text` PK). El catálogo de iconos disponibles,
sembrado desde `icons.generated.ts` del front. `skill_items.icon` es **FK contra
esta tabla**.

Vale la pena explicar esta última. En el front, `icon` es de tipo `IconName`,
generado a partir de los SVG vendorizados, así que un nombre mal escrito no
compila. Por API ese nombre entra como string y un valor inválido produciría un
hueco silencioso en la UI. La FK devuelve esa garantía al runtime. El coste es
real y hay que aceptarlo: cuando el front agregue iconos con `pnpm icons`, hay que
volver a sembrar el catálogo (un script, `pnpm seed:icons`). Es un recordatorio
manual a cambio de que un icono roto sea imposible.

`profile.socials[].icon` es también un `IconName` (o `null`), pero vive dentro de
un `jsonb`, donde una FK no alcanza. Ahí la validación contra el catálogo la hace
el caso de uso al guardar el perfil. Es la misma regla con dos mecanismos
distintos, y conviene tenerlo escrito: la asimetría no es un olvido, es lo que
`jsonb` permite.

### 4.2 Migraciones y seed

- `synchronize: false` **siempre**, en todos los entornos. Migraciones explícitas
  generadas con la CLI de TypeORM y commiteadas.
- El seed importa el contenido actual del front: 1 perfil (3 redes, 4 stats),
  6 proyectos, 4 experiencias, 4 categorías con 28 skills. Es idempotente
  (`ON CONFLICT DO NOTHING` por id), así que correrlo dos veces no duplica nada.
- El seed no hace `INSERT` directo: invoca los **casos de uso**. Así el contenido
  importado pasa por los mismos invariantes que el contenido creado por API, y el
  propio seed sirve como primera prueba de integración del dominio.

---

## 5. Contratos de API

Prefijo `/v1`. Swagger en `/docs`, protegido.

### 5.1 Lectura pública

| Método | Ruta | Devuelve |
| --- | --- | --- |
| `GET` | `/v1/profile?locale=es` | perfil resuelto a un idioma |
| `GET` | `/v1/projects?locale=es` | array ordenado por `position` |
| `GET` | `/v1/projects/:id?locale=es` | un proyecto |
| `GET` | `/v1/experience?locale=es` | array ordenado, con `isCurrent` derivado |
| `GET` | `/v1/skills?locale=es` | categorías con sus items, ambas ordenadas |

`locale` acepta `es` o `en`; por defecto `es` (el `DEFAULT_LOCALE` del front). Un
valor distinto es `400`, no un silencioso *fallback*: si alguien pide `fr`, la
respuesta correcta es decirle que no existe.

Las respuestas espejan exactamente los tipos `ResolvedProfile`, `ResolvedProject`,
`ResolvedExperienceItem` y `ResolvedSkillCategory` del front. Ejemplo:

```json
GET /v1/projects?locale=en
[
  {
    "id": "api-rest-eventos",
    "type": "REST API · Backend",
    "title": "...",
    "description": "...",
    "tags": ["NestJS", "PostgreSQL"],
    "icon": "🎟️",
    "gradient": ["#7c3aed", "#06b6d4"],
    "links": { "demo": "https://…", "github": "https://…" }
  }
]
```

`gradient` vuelve a ser una tupla y `links` un objeto con claves opcionales, aunque
en la base de datos sean columnas planas. La forma que ve el consumidor es la del
front, no la de la tabla — de nuevo, trabajo del presenter.

Los `GET` públicos responden con `Cache-Control: public, max-age=60,
stale-while-revalidate=300` y `ETag`. Contenido que cambia dos veces al año no
tiene por qué golpear la base de datos en cada visita, y esto también le sirve al
front cuando se conecte.

### 5.2 Escritura autenticada

| Método | Ruta |
| --- | --- |
| `POST` | `/v1/auth/login` |
| `GET` · `PUT` | `/v1/admin/profile` |
| `GET` · `POST` | `/v1/admin/projects` |
| `GET` · `PUT` · `DELETE` | `/v1/admin/projects/:id` |
| `PATCH` | `/v1/admin/projects/reorder` |
| — | mismo juego para `/v1/admin/experience` y `/v1/admin/skills` (con items anidados) |
| `GET` · `POST` | `/v1/admin/users` — solo `admin` |
| `PATCH` · `DELETE` | `/v1/admin/users/:id` — solo `admin` |
| `PATCH` | `/v1/admin/users/:id/password` — solo `admin` |

Los `GET` de `/admin` devuelven el objeto bilingüe completo y no aceptan `locale`.
`reorder` recibe la lista de ids en el orden deseado y reasigna `position` en una
transacción; sin él, reordenar seis proyectos serían seis `PUT` y un estado
intermedio inconsistente.

**`reorder` se declara antes que `:id` en el controller.** Nest resuelve rutas en
orden de declaración, así que un `@Patch(':id')` declarado primero se tragaría
`/reorder` y lo trataría como el id de un proyecto. Es la misma clase de trampa
que documenta la skill `nestjs-route-apigw-safe`: las rutas estáticas van siempre
antes de las paramétricas.

### 5.3 Operación

| Ruta | Notas |
| --- | --- |
| `GET /health` | **No toca la base de datos.** Responde `200` si el proceso vive |
| `GET /health/db` | Verifica la conexión con un `SELECT 1` |
| `GET /docs` | Swagger UI, detrás de autenticación |

La separación de los dos health checks no es cosmética: `/health` es el que golpea
el keepalive cada 12 minutos, y si consultara la base de datos mantendría la
conexión viva de forma permanente. Con Neon eso quemaría la cuota de horas de
cómputo; con Supabase es inofensivo, pero la separación deja la puerta abierta a
cambiar de proveedor sin rediseñar nada. `/health/db` existe para el chequeo
diario que sí necesita despertar la base de datos (§7.3).

---

## 6. Autenticación y errores

### 6.1 Auth y roles

Dos roles, y el reparto está en una sola frase: **el `editor` escribe contenido, el
`admin` además borra y administra usuarios.**

| Acción | anónimo | `editor` | `admin` |
| --- | --- | --- | --- |
| `GET /v1/*` públicos (texto resuelto) | ✔ | ✔ | ✔ |
| `GET /v1/admin/*` (objeto bilingüe) | ✘ | ✔ | ✔ |
| `POST`, `PUT` de contenido | ✘ | ✔ | ✔ |
| `PATCH .../reorder` | ✘ | ✔ | ✔ |
| `DELETE` de contenido | ✘ | ✘ | ✔ |
| `/v1/admin/users/*` | ✘ | ✘ | ✔ |

Por qué `DELETE` queda solo en `admin`: crear y editar son reversibles —se corrige
el texto y ya—, pero borrar un proyecto destruye contenido bilingüe que costó
escribir y no hay historial que lo recupere. Es la única asimetría real entre los
dos roles, y es la que justifica que el rol exista.

**No hay registro público.** Los usuarios los crea un `admin` desde
`POST /v1/admin/users`, con la contraseña en el cuerpo; el hash lo calcula el
servidor y la contraseña nunca se guarda ni se registra en logs.

**Bootstrap.** Un despliegue nuevo tiene la base vacía, así que no habría con qué
autenticarse para crear el primer usuario. Al arrancar, si no existe ningún
usuario con rol `admin`, se crea uno desde `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH`.
Es idempotente: con un admin ya existente no hace nada, ni siquiera si el hash de
la variable cambió. Consecuencia que hay que aceptar: **cambiar la contraseña se
hace por API, no por variable de entorno.** Y si se pierde el acceso, el escape es
un `UPDATE` en el editor SQL de Supabase — que es exactamente por qué no hace
falta un flujo de recuperación por correo en esta fase.

- `POST /v1/auth/login` → `{ accessToken, expiresIn }`. JWT firmado con
  `JWT_SECRET`, vigencia 8 horas, con `{ sub, email, role }` en el payload.
  Un usuario con `is_active = false` recibe 401 al intentar entrar.
- `GET /v1/auth/me` → el usuario del token. El panel de la Fase 2 lo necesita para
  saber si debe mostrar los botones de borrar.
- `JwtAuthGuard` en todo `/v1/admin/*`, y `RolesGuard` leyendo el `role` del token.
- **El `RolesGuard` deniega si la ruta no declara `@Roles(...)`.** Falla cerrado a
  propósito: si mañana se agrega un controller de admin y alguien olvida el
  decorador, el resultado es un 403 molesto en vez de un endpoint abierto. Un
  guard que permite por omisión convierte un olvido en un agujero.
- `@nestjs/throttler` en el login: 5 intentos por minuto por IP. En Render el
  contenedor es persistente y de una sola instancia, así que el contador en
  memoria **sí funciona** — no hace falta Redis. Esa es la diferencia con el front,
  que necesita Upstash porque en Vercel cada invocación arranca limpia.
- Sin refresh token, a propósito: con 8 horas de vigencia, el panel de la Fase 2
  pedirá login una vez por jornada. Un ciclo de refresh es infraestructura de
  sesión que dos usuarios no justifican todavía.

**Invariante de dominio: siempre queda al menos un `admin` activo.** Borrar el
último administrador, degradarlo a `editor` o desactivarlo lanza
`LastAdminError`. Sin esa regla, un clic desafortunado deja el sistema sin nadie
que pueda administrarlo y la única salida vuelve a ser el editor SQL de Supabase.
Vive en el dominio y no en el controller porque es una regla del negocio, no del
transporte: también tiene que cumplirse cuando la invoque un script.

**Autorización en dos niveles**, por la misma razón que la validación de §3.4. El
guard es la barrera HTTP y devuelve 403 antes de tocar la aplicación; además, los
casos de uso de borrado reciben el rol del actor y lanzan `ForbiddenActionError`
si no es `admin`. El guard cubre el tráfico HTTP; el caso de uso cubre las
invocaciones desde el seed, desde scripts y desde tests, donde no hay guard que
proteja nada.

**Límite conocido:** como el rol viaja dentro del JWT, degradar a un `editor` o
desactivarlo no surte efecto hasta que su token expire — hasta 8 horas. Verificar
`is_active` contra la base de datos en cada petición eliminaría la ventana, pero
convertiría cada llamada autenticada en una consulta extra y rompería el sentido de
un token sin estado. Con dos usuarios de confianza y un `editor` que no puede
borrar, el riesgo es aceptable. Si algún día hace falta cortar el acceso ya, rotar
`JWT_SECRET` invalida todos los tokens al instante, gratis y sin código nuevo.
- `/docs` no usa ese guard, usa **basic auth** (`express-basic-auth`) con las
  mismas credenciales del administrador. La razón es práctica: un guard de JWT
  espera una cabecera `Authorization: Bearer` que el navegador no envía al abrir
  una URL, así que Swagger UI quedaría inalcanzable justo cuando es el panel de
  administración provisional. Con basic auth el navegador pide usuario y
  contraseña, y una vez dentro el botón *Authorize* de Swagger sirve para pegar el
  JWT y ejecutar las escrituras.
- `@nestjs/throttler` en el login: 5 intentos por minuto por IP. En Render el
  contenedor es persistente y de una sola instancia, así que el contador en
  memoria **sí funciona** — no hace falta Redis. Esa es la diferencia con el front,
  que necesita Upstash porque en Vercel cada invocación arranca limpia.
- Sin refresh token, a propósito: con 8 horas de vigencia, el panel de la Fase 2
  pedirá login una vez por jornada de trabajo. Un ciclo de refresh es
  infraestructura de sesión que un solo usuario no justifica todavía.

### 6.2 Errores

Los casos de uso nunca lanzan excepciones HTTP: lanzan errores de dominio. Un
único `DomainErrorFilter` los traduce.

| Error de dominio | HTTP | Cuándo |
| --- | --- | --- |
| `NotFoundError` | 404 | id que no existe |
| `DuplicateSlugError` | 409 | crear un proyecto con un id ya usado |
| `InvalidContentError` | 422 | violación de invariante del dominio (p. ej. `Localized` incompleto) |
| `UnauthorizedError` | 401 | credenciales o token inválidos, o usuario desactivado |
| `ForbiddenActionError` | 403 | rol insuficiente (un `editor` intentando borrar) |
| `EmailAlreadyUsedError` | 409 | crear un usuario con un correo ya registrado |
| `LastAdminError` | 409 | borrar, degradar o desactivar al último `admin` activo |
| fallo de DTO | 400 | lo produce el `ValidationPipe`, antes de llegar al caso de uso |

La distinción entre 400 y 422 es intencional y sale de §3.4: **400 es "tu petición
está mal formada"** (la detecta el DTO) y **422 es "tu petición es válida pero el
dominio no la acepta"**. Un consumidor puede distinguir entre corregir la forma y
corregir el significado.

Cuerpo uniforme: `{ statusCode, code, message, details? }`. `code` es un
identificador estable (`PROJECT_NOT_FOUND`) para que el panel de la Fase 2 pueda
reaccionar sin parsear mensajes en español.

---

## 7. Despliegue

Todo gratis, sin tarjeta, verificado a agosto de 2026.

| Pieza | Servicio | Plan | Tarjeta |
| --- | --- | --- | --- |
| API | Render — web service | Free, 750 h/mes | No |
| Base de datos | Supabase Postgres | Free, 500 MB, permanente | No |
| Keepalive y CI | GitHub Actions | Free | No |

### 7.1 Por qué esta combinación

**Render** es el único host de contenedores con free tier real que no pide tarjeta
(Koyeb puede pedirla si no logra verificarte; Northflank la exige). Su free tier
duerme el servicio a los 15 minutos de inactividad, con un arranque en frío de
30 a 60 segundos.

**Supabase y no Neon**, aunque Neon sea el favorito obvio para Postgres serverless.
El free de Neon da 100 horas de cómputo al mes; mantener el backend despierto con
un pool de conexiones abierto impide el autosuspend y quema esa cuota en unos
cuatro días, dejando la base de datos suspendida hasta el siguiente ciclo.
Supabase no mide horas de cómputo: solo pausa el proyecto tras 7 días sin
actividad, y eso se evita con un ping. Neon sigue siendo viable con cuidado
(`/health` sin base de datos, `idleTimeout` corto), pero sería una restricción que
recordar para siempre.

**El `Postgres` gratis de Render no se usa**: expira 30 días después de creado y se
borra tras 14 de gracia. No es una base de datos, es una demo.

### 7.2 Contenedor

Dockerfile multi-stage sobre `node:22-alpine`: una etapa compila con dev
dependencies, la otra corre solo con las de producción, como usuario no root.
Escucha en el `PORT` que inyecta Render.

Las migraciones corren en un entrypoint, antes de arrancar Nest. Render no ofrece
*pre-deploy command* en el plan free, y de todos modos con una sola instancia no
hay carrera posible entre migraciones concurrentes.

Conexión a Supabase por el **pooler** (puerto 6543, `pgbouncer=true`), con
`max: 5` en el pool. El free tier limita conexiones y el pooler es lo que hace que
un `max` alto no las agote.

### 7.3 Mantenerlo despierto

Dos cron de GitHub Actions:

| Cron | Golpea | Para qué |
| --- | --- | --- |
| cada 12 min | `/health` | evita el sleep de Render y su arranque en frío de 30-60 s |
| diario | `/health/db` | evita que Supabase pause el proyecto por 7 días de inactividad |

El segundo es fácil de olvidar y su ausencia es una caída silenciosa: el keepalive
de `/health` **no toca la base de datos** (§5.3), así que mantendría la API viva
mientras Supabase pausa el Postgres por su cuenta.

Las cuentas cuadran con la cuota: 24 h × 30 días = **720 h de las 750 h/mes**. Con
un margen de 30 horas, y con una consecuencia que hay que tener presente —**las
750 h son por cuenta, no por servicio**, así que solo puede haber un servicio free
de Render despierto. Por eso el panel de la Fase 2 irá a Vercel, que no consume
esa bolsa.

Riesgo conocido: GitHub deshabilita los cron programados tras 60 días sin
actividad en el repositorio. Si eso pasa, el servicio vuelve a dormirse y la
primera visita paga el arranque en frío. Alternativa gratuita y sin tarjeta si
molesta: cron-job.org.

### 7.4 Variables de entorno

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Postgres de Supabase, cadena del pooler |
| `JWT_SECRET` | firma de tokens |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` | bootstrap del primer `admin` (§6.1); se ignoran si ya existe uno |
| `CORS_ORIGINS` | orígenes permitidos, separados por coma |
| `PORT` | lo inyecta Render |
| `NODE_ENV` | |

La configuración se valida al arrancar: si falta una variable, el proceso muere
con un mensaje que la nombra. Un backend que arranca a medias y falla en la
primera petición es peor que uno que no arranca.

### 7.5 CI

GitHub Actions en cada push: `lint`, `typecheck`, tests con la puerta de cobertura
al 95%, y build del Docker. Render despliega solo cuando `main` avanza.

---

## 8. Testing

Jest, 95% mínimo en ramas, funciones, líneas y sentencias, según la skill del
proyecto. Un archivo de test por unidad, organizados por capa:

| Capa | Cómo se prueba |
| --- | --- |
| `domain/` | puro, sin mocks. Value objects e invariantes: `Localized` incompleto, slug inválido, hex mal formado, proyecto sin enlaces |
| `application/` | casos de uso con los puertos mockeados. Verifica orquestación y errores de dominio, nunca SQL |
| `interface/` | controllers con los casos de uso mockeados. Verifica códigos HTTP, forma de la respuesta y el mapeo del filtro de errores |
| `infrastructure/` | repositorios y mappers contra un Postgres real |
| e2e | Supertest contra la app completa: login, CRUD, y que los `GET` públicos devuelvan exactamente la forma que el front espera |

Los tests de infraestructura y los e2e corren contra un Postgres real —un
`services: postgres` de GitHub Actions en CI, docker compose en local— y no
contra SQLite en memoria. SQLite no tiene `jsonb` ni `text[]`, así que probar ahí
sería probar otro sistema.

La matriz de permisos de §6.1 se prueba como matriz, no como casos sueltos: un
test recorre cada combinación de rol y endpoint y verifica el código esperado
(200/403). Escrita así, agregar un endpoint de admin obliga a declarar su fila, y
un `@Roles` mal puesto sale en rojo. Se prueban también los dos invariantes que
más caro cuestan si fallan: que el último `admin` no se pueda borrar ni degradar,
y que el `RolesGuard` deniegue cuando falta el decorador.

Otro test que merece mención aparte: **el que compara la respuesta de los `GET`
públicos con las formas que exporta `@/content` del front**. Es el contrato que
hace posible la Fase 5, y sin una prueba explícita se rompería sin que nadie se
enterara hasta el día de conectar.

---

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El keepalive falla y la primera visita paga 30-60 s | Cuando el front se conecte, consumirá la API con ISR y *fallback* al contenido local, así que un backend dormido degrada, no rompe |
| Supabase pausa el proyecto a los 7 días | Cron diario a `/health/db` (§7.3) |
| Los free tiers cambian de reglas | Nada del diseño es específico de Render: es un contenedor Docker con `DATABASE_URL`. Migrar es cambiar de host, no reescribir |
| `icon_catalog` se desincroniza del front | `pnpm seed:icons` al agregar iconos; sin eso, la FK rechaza el icono nuevo — falla ruidoso, no silencioso |
| El front y la API divergen en las formas | El test de contrato de §8 |

---

## 10. Criterios de aceptación

1. Los cinco `GET` públicos responden con las formas exactas que exporta
   `@/content`, en `es` y en `en`.
2. El CRUD autenticado permite crear, editar, borrar y reordenar proyectos,
   experiencias y skills, y editar el perfil.
3. Un intento de escritura sin token válido devuelve 401.
4. La matriz de §6.1 se cumple: un `editor` escribe y reordena contenido, recibe
   403 al intentar cualquier `DELETE` y 403 en `/v1/admin/users/*`; un `admin`
   hace todo. El último `admin` activo no se puede borrar, degradar ni desactivar.
5. El seed carga el contenido actual y correrlo dos veces no duplica nada.
6. Cobertura ≥ 95% en las cuatro métricas.
7. La API responde en su URL pública de internet, con Swagger protegido.
8. Los dos cron de keepalive están verdes y el consumo mensual de Render se
   mantiene por debajo de 750 horas.
9. El coste total es \$0 y en ningún proveedor se registró una tarjeta.

---

## 11. Fases siguientes

| Fase | Qué |
| --- | --- |
| 2 | Panel admin en Next.js 16 + Tailwind 4, en Vercel Hobby. Edición bilingüe lado a lado |
| 3 | Mensajes de contacto: persistencia, rate limit, envío por Resend, bandeja |
| 4 | Métricas propias: visitas, vistas por proyecto, clics en demo y GitHub |
| 5 | Conectar el front: reescribir `src/content/index.ts` contra la API, con ISR y *fallback* |
