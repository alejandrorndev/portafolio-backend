import type { MigrationInterface, QueryRunner } from 'typeorm'

/*
 * -----------------------------------------------------------------------------
 * Esquema inicial.
 * -----------------------------------------------------------------------------
 * Escrita a mano en SQL y no generada, por dos razones:
 *
 *   1. Los CHECK son el punto del diseño. Ningun generador produce "un proyecto
 *      necesita al menos un enlace"; eso hay que escribirlo.
 *   2. Las restricciones UNIQUE de `position` son DEFERRABLE INITIALLY DEFERRED.
 *      Sin eso, reordenar seria imposible: al mover el elemento A a la posicion
 *      del B, durante un instante dos filas comparten posicion, y una UNIQUE
 *      inmediata abortaria la transaccion. Diferida, Postgres la comprueba en el
 *      COMMIT, cuando el orden ya volvio a ser coherente.
 *
 * Las mismas reglas viven en los value objects del dominio. La duplicacion es
 * intencional: el dominio da mensajes utiles a quien edita, y la base de datos
 * hace imposible el dato malo aunque entre por un script, un seed o una consulta
 * manual a las tres de la mañana.
 * -----------------------------------------------------------------------------
 */
export class InitialSchema1755600000000 implements MigrationInterface {
  name = 'InitialSchema1755600000000'

  async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() para los ids de skill_items y users.
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    // --- Perfil: exactamente una fila ---------------------------------------
    await queryRunner.query(`
      CREATE TABLE "profile" (
        "id"               text        NOT NULL,
        "full_name"        text        NOT NULL,
        "display_name"     jsonb       NOT NULL,
        "brand"            text        NOT NULL,
        "email"            text        NOT NULL,
        "location"         jsonb       NOT NULL,
        "available"        boolean     NOT NULL,
        "headline"         jsonb       NOT NULL,
        "role"             jsonb       NOT NULL,
        "summary"          jsonb       NOT NULL,
        "bio"              jsonb       NOT NULL,
        "typewriter_roles" jsonb       NOT NULL,
        "socials"          jsonb       NOT NULL,
        "stats"            jsonb       NOT NULL,
        "cv"               jsonb,
        "created_at"       timestamptz NOT NULL DEFAULT now(),
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profile" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_profile_singleton" CHECK ("id" = 'singleton')
      )
    `)

    // --- Proyectos -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id"            text        NOT NULL,
        "type"          jsonb       NOT NULL,
        "title"         jsonb       NOT NULL,
        "description"   jsonb       NOT NULL,
        "tags"          text[]      NOT NULL,
        "icon"          text        NOT NULL,
        "gradient_from" text        NOT NULL,
        "gradient_to"   text        NOT NULL,
        "link_demo"     text,
        "link_github"   text,
        "position"      integer     NOT NULL,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_projects_id_slug"
          CHECK ("id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "CHK_projects_tags" CHECK (cardinality("tags") >= 1),
        CONSTRAINT "CHK_projects_gradient_from"
          CHECK ("gradient_from" ~ '^#[0-9a-f]{6}$'),
        CONSTRAINT "CHK_projects_gradient_to"
          CHECK ("gradient_to" ~ '^#[0-9a-f]{6}$'),
        CONSTRAINT "CHK_projects_demo_https"
          CHECK ("link_demo" IS NULL OR "link_demo" LIKE 'https://%'),
        CONSTRAINT "CHK_projects_github_https"
          CHECK ("link_github" IS NULL OR "link_github" LIKE 'https://%'),
        CONSTRAINT "CHK_projects_one_link"
          CHECK ("link_demo" IS NOT NULL OR "link_github" IS NOT NULL),
        CONSTRAINT "CHK_projects_position" CHECK ("position" >= 0),
        CONSTRAINT "UQ_projects_position" UNIQUE ("position")
          DEFERRABLE INITIALLY DEFERRED
      )
    `)

    // --- Experiencia ---------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "experience" (
        "id"           text        NOT NULL,
        "period_start" text        NOT NULL,
        "period_end"   text,
        "company"      text        NOT NULL,
        "role"         jsonb       NOT NULL,
        "description"  jsonb       NOT NULL,
        "stack"        text[]      NOT NULL,
        "accent"       text        NOT NULL,
        "position"     integer     NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experience" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_experience_id_slug"
          CHECK ("id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "CHK_experience_stack" CHECK (cardinality("stack") >= 1),
        CONSTRAINT "CHK_experience_accent"
          CHECK ("accent" IN ('purple', 'cyan', 'pink', 'gold')),
        CONSTRAINT "CHK_experience_position" CHECK ("position" >= 0),
        CONSTRAINT "UQ_experience_position" UNIQUE ("position")
          DEFERRABLE INITIALLY DEFERRED
      )
    `)

    /*
     * --- Catalogo de iconos -------------------------------------------------
     * Se siembra desde `icons.generated.ts` del front. `skill_items.icon` es FK
     * contra esta tabla, asi que un icono que el front no tiene vendorizado no
     * se puede guardar: es la garantia que el front tiene en tiempo de
     * compilacion, traida al runtime.
     */
    await queryRunner.query(`
      CREATE TABLE "icon_catalog" (
        "name" text NOT NULL,
        CONSTRAINT "PK_icon_catalog" PRIMARY KEY ("name")
      )
    `)

    // --- Skills --------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "skill_categories" (
        "id"         text        NOT NULL,
        "title"      jsonb       NOT NULL,
        "accent"     text        NOT NULL,
        "position"   integer     NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_skill_categories" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_skill_categories_id_slug"
          CHECK ("id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "CHK_skill_categories_accent"
          CHECK ("accent" IN ('purple', 'cyan', 'pink', 'gold')),
        CONSTRAINT "CHK_skill_categories_position" CHECK ("position" >= 0),
        CONSTRAINT "UQ_skill_categories_position" UNIQUE ("position")
          DEFERRABLE INITIALLY DEFERRED
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "skill_items" (
        "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
        "category_id" text    NOT NULL,
        "name"        text    NOT NULL,
        "icon"        text    NOT NULL,
        "position"    integer NOT NULL,
        CONSTRAINT "PK_skill_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_skill_items_category" FOREIGN KEY ("category_id")
          REFERENCES "skill_categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_skill_items_icon" FOREIGN KEY ("icon")
          REFERENCES "icon_catalog" ("name") ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT "CHK_skill_items_position" CHECK ("position" >= 0),
        CONSTRAINT "UQ_skill_items_position" UNIQUE ("category_id", "position")
          DEFERRABLE INITIALLY DEFERRED
      )
    `)

    await queryRunner.query(
      'CREATE INDEX "IDX_skill_items_category" ON "skill_items" ("category_id")',
    )

    // --- Usuarios ------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid        NOT NULL DEFAULT gen_random_uuid(),
        "email"         text        NOT NULL,
        "password_hash" text        NOT NULL,
        "role"          text        NOT NULL,
        "is_active"     boolean     NOT NULL DEFAULT true,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_role" CHECK ("role" IN ('admin', 'editor'))
      )
    `)

    /*
     * UNIQUE sobre lower(email), no sobre la columna: sin esto
     * "Admin@correo.co" y "admin@correo.co" serian dos cuentas distintas de la
     * misma persona, y el login de una no encontraria a la otra.
     */
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_email_lower" ON "users" (lower("email"))',
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Orden inverso: skill_items referencia skill_categories e icon_catalog.
    await queryRunner.query('DROP TABLE "users"')
    await queryRunner.query('DROP TABLE "skill_items"')
    await queryRunner.query('DROP TABLE "skill_categories"')
    await queryRunner.query('DROP TABLE "icon_catalog"')
    await queryRunner.query('DROP TABLE "experience"')
    await queryRunner.query('DROP TABLE "projects"')
    await queryRunner.query('DROP TABLE "profile"')
  }
}
