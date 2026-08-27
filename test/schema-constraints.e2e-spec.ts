import type { DataSource } from 'typeorm'
import { createTestDataSource, resetSchema, seedIcons, truncateAll } from './helpers/database'

/*
 * -----------------------------------------------------------------------------
 * Las reglas que hace cumplir Postgres.
 * -----------------------------------------------------------------------------
 * Todo lo que se prueba aqui YA lo valida el dominio. La pregunta que responde
 * este archivo es otra: si el dato entra por un camino que no pasa por el
 * dominio —un seed, un script de migracion, una consulta manual a las tres de la
 * mañana— ¿la base de datos lo para?
 *
 * Por eso los INSERT son SQL crudo. Usar los repositorios probaria el dominio
 * otra vez y dejaria los CHECK sin verificar.
 * -----------------------------------------------------------------------------
 */

const PROJECT_COLUMNS =
  '("id", "type", "title", "description", "tags", "icon", "gradient_from", "gradient_to", "link_demo", "link_github", "position")'

const localized = JSON.stringify({ es: 'a', en: 'b' })

describe('restricciones del esquema', () => {
  let dataSource: DataSource

  const insertProject = (values: unknown[]): Promise<unknown> =>
    dataSource.query(
      `INSERT INTO "projects" ${PROJECT_COLUMNS} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values,
    )

  const validProject = (overrides: Partial<Record<number, unknown>> = {}): unknown[] => {
    const base: unknown[] = [
      'api-rest',
      localized,
      localized,
      localized,
      ['NestJS'],
      '🎟️',
      '#7c3aed',
      '#06b6d4',
      null,
      'https://github.com/a/b',
      0,
    ]

    for (const [index, value] of Object.entries(overrides)) {
      base[Number(index)] = value
    }

    return base
  }

  beforeAll(async () => {
    dataSource = createTestDataSource()
    await dataSource.initialize()
    await resetSchema(dataSource)
  }, 60_000)

  afterAll(async () => {
    await dataSource.destroy()
  })

  beforeEach(async () => {
    await truncateAll(dataSource)
  })

  describe('projects', () => {
    it('acepta un proyecto valido', async () => {
      await expect(insertProject(validProject())).resolves.toBeDefined()
    })

    it('rechaza un proyecto SIN NINGUN enlace', async () => {
      // La regla del front —"un proyecto necesita al menos un enlace"— existe
      // aqui tambien, y aqui es imposible de violar.
      await expect(insertProject(validProject({ 8: null, 9: null }))).rejects.toThrow(
        /CHK_projects_one_link/,
      )
    })

    it('rechaza un enlace que no es https', async () => {
      await expect(insertProject(validProject({ 9: 'http://github.com/a/b' }))).rejects.toThrow(
        /CHK_projects_github_https/,
      )
    })

    it('rechaza un id que no es kebab-case', async () => {
      await expect(insertProject(validProject({ 0: 'API_Rest' }))).rejects.toThrow(
        /CHK_projects_id_slug/,
      )
    })

    it('rechaza un gradiente que no es hexadecimal de 6 digitos', async () => {
      await expect(insertProject(validProject({ 6: '#fff' }))).rejects.toThrow(
        /CHK_projects_gradient_from/,
      )
    })

    it('rechaza una lista de tags vacia', async () => {
      await expect(insertProject(validProject({ 4: [] }))).rejects.toThrow(/CHK_projects_tags/)
    })

    it('rechaza una position negativa', async () => {
      await expect(insertProject(validProject({ 10: -1 }))).rejects.toThrow(/CHK_projects_position/)
    })

    it('rechaza dos proyectos en la misma position', async () => {
      await insertProject(validProject())

      await expect(insertProject(validProject({ 0: 'otro' }))).rejects.toThrow(
        /UQ_projects_position/,
      )
    })

    it('permite compartir position DENTRO de una transaccion, si al final no se comparte', async () => {
      // Es lo que hace posible reordenar. La UNIQUE es DEFERRABLE INITIALLY
      // DEFERRED, asi que Postgres la comprueba en el COMMIT.
      await insertProject(validProject({ 0: 'a', 10: 0 }))
      await insertProject(validProject({ 0: 'b', 10: 1 }))

      await expect(
        dataSource.transaction(async (manager) => {
          await manager.query('UPDATE "projects" SET "position" = 1 WHERE "id" = $1', ['a'])
          await manager.query('UPDATE "projects" SET "position" = 0 WHERE "id" = $1', ['b'])
        }),
      ).resolves.toBeUndefined()

      const rows = await dataSource.query<{ id: string; position: number }[]>(
        'SELECT "id", "position" FROM "projects" ORDER BY "position"',
      )

      expect(rows).toEqual([
        { id: 'b', position: 0 },
        { id: 'a', position: 1 },
      ])
    })
  })

  describe('profile', () => {
    it('rechaza un id distinto de singleton', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "profile" ("id", "full_name", "display_name", "brand", "email", "location", "available", "headline", "role", "summary", "bio", "typewriter_roles", "socials", "stats")
           VALUES ('otro', 'a', '{}', 'b', 'c@d.co', $1, true, $1, $1, $1, '[]', '[]', '[]', '[]')`,
          [localized],
        ),
      ).rejects.toThrow(/CHK_profile_singleton/)
    })
  })

  describe('experience y skill_categories', () => {
    it('rechazan un acento que no existe en el sistema de diseño', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "skill_categories" ("id", "title", "accent", "position") VALUES ('backend', $1, 'red', 0)`,
          [localized],
        ),
      ).rejects.toThrow(/CHK_skill_categories_accent/)
    })

    it('experience rechaza un stack vacio', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "experience" ("id", "period_start", "company", "role", "description", "stack", "accent", "position")
           VALUES ('homepower', '2024', 'HP', $1, $1, $2, 'purple', 0)`,
          [localized, []],
        ),
      ).rejects.toThrow(/CHK_experience_stack/)
    })
  })

  describe('skill_items', () => {
    beforeEach(async () => {
      await seedIcons(dataSource, ['nestjs-plain'])
      await dataSource.query(
        `INSERT INTO "skill_categories" ("id", "title", "accent", "position") VALUES ('backend', $1, 'purple', 0)`,
        [localized],
      )
    })

    it('acepta un icono que existe en el catalogo', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "skill_items" ("category_id", "name", "icon", "position") VALUES ('backend', 'NestJS', 'nestjs-plain', 0)`,
        ),
      ).resolves.toBeDefined()
    })

    it('rechaza un icono que el front no tiene vendorizado', async () => {
      // Es la garantia que el front tiene en tiempo de compilacion (el tipo
      // IconName), traida al runtime: un icono inexistente seria un hueco
      // silencioso en la UI.
      await expect(
        dataSource.query(
          `INSERT INTO "skill_items" ("category_id", "name", "icon", "position") VALUES ('backend', 'Inventado', 'no-existe-plain', 0)`,
        ),
      ).rejects.toThrow(/FK_skill_items_icon/)
    })

    it('rechaza un item de una categoria que no existe', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "skill_items" ("category_id", "name", "icon", "position") VALUES ('fantasma', 'NestJS', 'nestjs-plain', 0)`,
        ),
      ).rejects.toThrow(/FK_skill_items_category/)
    })

    it('rechaza borrar un icono que algun skill esta usando', async () => {
      await dataSource.query(
        `INSERT INTO "skill_items" ("category_id", "name", "icon", "position") VALUES ('backend', 'NestJS', 'nestjs-plain', 0)`,
      )

      await expect(
        dataSource.query(`DELETE FROM "icon_catalog" WHERE "name" = 'nestjs-plain'`),
      ).rejects.toThrow(/FK_skill_items_icon/)
    })
  })

  describe('users', () => {
    const insertUser = (email: string, role = 'admin'): Promise<unknown> =>
      dataSource.query(
        `INSERT INTO "users" ("email", "password_hash", "role") VALUES ($1, '$2b$12$hash', $2)`,
        [email, role],
      )

    it('rechaza un rol que no existe', async () => {
      await expect(insertUser('a@correo.co', 'viewer')).rejects.toThrow(/CHK_users_role/)
    })

    it('rechaza el mismo correo con otras mayusculas', async () => {
      await insertUser('admin@correo.co')

      // Sin el indice sobre lower(email), estas serian dos cuentas distintas de
      // la misma persona.
      await expect(insertUser('ADMIN@correo.co')).rejects.toThrow(/UQ_users_email_lower/)
    })
  })

  describe('migracion', () => {
    it('revert deja el esquema sin las tablas del proyecto', async () => {
      await dataSource.undoLastMigration()

      const rows = await dataSource.query<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      )
      const tables = rows.map((row) => row.table_name)

      expect(tables).not.toContain('projects')
      expect(tables).not.toContain('users')
      // La tabla de control de migraciones sobrevive: la gestiona TypeORM.
      expect(tables).toContain('migrations')

      // Se restaura para no dejar la base a medias para el resto de la suite.
      await dataSource.runMigrations()
    }, 60_000)
  })
})
