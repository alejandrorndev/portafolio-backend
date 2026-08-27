import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id!: string

  /**
   * El unico indice es UNIQUE sobre `lower(email)`, no sobre la columna.
   *
   * Asi "Admin@correo.co" y "admin@correo.co" no pueden coexistir aunque el
   * dominio fallara en normalizar.
   */
  @Column('text')
  email!: string

  @Column('text', { name: 'password_hash' })
  passwordHash!: string

  @Column('text')
  role!: string

  @Column('boolean', { name: 'is_active', default: true })
  isActive!: boolean

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date
}
