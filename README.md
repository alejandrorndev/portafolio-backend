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
- Docker (para el Postgres de desarrollo)

## Arrancar

```bash
pnpm install
cp .env.example .env
pnpm db:up        # Postgres en localhost:5432
pnpm start:dev    # API en localhost:3001
```

## Comandos

| Comando          | Qué hace                                     |
| ---------------- | -------------------------------------------- |
| `pnpm start:dev` | Servidor en modo watch                       |
| `pnpm build`     | Compila a `dist/`                            |
| `pnpm verify`    | Tipos + lint + formato + tests con cobertura |
| `pnpm test`      | Tests unitarios                              |
| `pnpm test:e2e`  | Tests end to end (requieren Postgres arriba) |
| `pnpm db:up`     | Levanta Postgres                             |
| `pnpm db:down`   | Lo baja                                      |

`pnpm verify` es exactamente lo que corre CI. Si pasa en local, pasa allá.

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

| Variable       | Obligatoria | Para qué                                              |
| -------------- | ----------- | ----------------------------------------------------- |
| `DATABASE_URL` | Sí          | Postgres. En producción, la cadena del pooler         |
| `NODE_ENV`     | No          | `development` por defecto                             |
| `PORT`         | No          | 3001 en local, para no chocar con el front en el 3000 |
| `CORS_ORIGINS` | No          | Orígenes permitidos. Vacío significa **ninguno**      |

## Estado

| Etapa | Descripción                  | Estado |
| ----- | ---------------------------- | ------ |
| 0     | Andamiaje                    | ✅     |
| 1     | Dominio                      | ✅     |
| 2     | Persistencia                 | ⬜     |
| 3     | Casos de uso de contenido    | ⬜     |
| 4     | Auth, roles y usuarios       | ⬜     |
| 5     | Capa HTTP                    | ⬜     |
| 6     | Seed y contrato con el front | ⬜     |
| 7     | Deploy y operación           | ⬜     |
