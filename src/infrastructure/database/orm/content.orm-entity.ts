import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

/*
 * -----------------------------------------------------------------------------
 * Entidades de TypeORM. NO son las entidades del dominio.
 * -----------------------------------------------------------------------------
 * Aqui viven los decoradores, los nombres de columna en snake_case y los tipos
 * de Postgres. Las reglas de negocio viven en `src/domain/entities`, y los
 * mappers traducen entre las dos formas.
 *
 * La duplicacion es deliberada: un `@Column` en el dominio ataria el modelo de
 * negocio a Postgres, y cambiar de base de datos obligaria a tocar las reglas.
 *
 * Estas clases no validan nada. Lo que protege los datos son los CHECK de la
 * migracion (a nivel de base de datos) y los value objects del dominio (a nivel
 * de aplicacion).
 * -----------------------------------------------------------------------------
 */

/** Forma de un texto traducido tal como se guarda en jsonb. */
export type LocalizedColumn = Record<string, string>

@Entity('profile')
export class ProfileOrmEntity {
  /** Siempre 'singleton': la migracion lo fuerza con un CHECK. */
  @PrimaryColumn('text')
  id!: string

  @Column('text', { name: 'full_name' })
  fullName!: string

  @Column('jsonb', { name: 'display_name' })
  displayName!: { first: string; last: string }

  @Column('text')
  brand!: string

  @Column('text')
  email!: string

  @Column('jsonb')
  location!: LocalizedColumn

  @Column('boolean')
  available!: boolean

  @Column('jsonb')
  headline!: LocalizedColumn

  @Column('jsonb')
  role!: LocalizedColumn

  @Column('jsonb')
  summary!: LocalizedColumn

  @Column('jsonb')
  bio!: LocalizedColumn[]

  @Column('jsonb', { name: 'typewriter_roles' })
  typewriterRoles!: LocalizedColumn[]

  @Column('jsonb')
  socials!: unknown[]

  @Column('jsonb')
  stats!: unknown[]

  @Column('jsonb', { nullable: true })
  cv!: LocalizedColumn | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('projects')
export class ProjectOrmEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('jsonb')
  type!: LocalizedColumn

  @Column('jsonb')
  title!: LocalizedColumn

  @Column('jsonb')
  description!: LocalizedColumn

  @Column('text', { array: true })
  tags!: string[]

  @Column('text')
  icon!: string

  @Column('text', { name: 'gradient_from' })
  gradientFrom!: string

  @Column('text', { name: 'gradient_to' })
  gradientTo!: string

  @Column('text', { name: 'link_demo', nullable: true })
  linkDemo!: string | null

  @Column('text', { name: 'link_github', nullable: true })
  linkGithub!: string | null

  @Column('integer')
  position!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('experience')
export class ExperienceOrmEntity {
  @PrimaryColumn('text')
  id!: string

  /** Etiqueta, no fecha: el front muestra "2024" o "Ene 2024" tal cual. */
  @Column('text', { name: 'period_start' })
  periodStart!: string

  /** `null` significa "en curso". */
  @Column('text', { name: 'period_end', nullable: true })
  periodEnd!: string | null

  @Column('text')
  company!: string

  @Column('jsonb')
  role!: LocalizedColumn

  @Column('jsonb')
  description!: LocalizedColumn

  @Column('text', { array: true })
  stack!: string[]

  @Column('text')
  accent!: string

  @Column('integer')
  position!: number

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('icon_catalog')
export class IconCatalogOrmEntity {
  /** Nombre del SVG vendorizado por el front (`icons.generated.ts`). */
  @PrimaryColumn('text')
  name!: string
}

@Entity('skill_categories')
export class SkillCategoryOrmEntity {
  @PrimaryColumn('text')
  id!: string

  @Column('jsonb')
  title!: LocalizedColumn

  @Column('text')
  accent!: string

  @Column('integer')
  position!: number

  @OneToMany(() => SkillItemOrmEntity, (item) => item.category, { cascade: false })
  items!: SkillItemOrmEntity[]

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}

@Entity('skill_items')
export class SkillItemOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  @Column('text', { name: 'category_id' })
  categoryId!: string

  @ManyToOne(() => SkillCategoryOrmEntity, (category) => category.items, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category!: SkillCategoryOrmEntity

  @Column('text')
  name!: string

  /** FK contra `icon_catalog`: un icono inexistente es imposible de guardar. */
  @Column('text')
  icon!: string

  @Column('integer')
  position!: number
}
