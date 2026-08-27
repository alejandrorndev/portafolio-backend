import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { User } from '@/domain/entities'
import type { IUserRepository } from '@/domain/ports'
import { UserMapper } from '@/infrastructure/database/mappers'
import { UserOrmEntity } from '@/infrastructure/database/orm'

@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(): Promise<User[]> {
    const rows = await this.dataSource
      .getRepository(UserOrmEntity)
      .find({ order: { email: 'ASC' } })

    return rows.map((row) => UserMapper.toDomain(row))
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.dataSource.getRepository(UserOrmEntity).findOneBy({ id })

    return row === null ? null : UserMapper.toDomain(row)
  }

  /**
   * Busca comparando en minusculas, igual que el indice unico.
   *
   * Si comparara la columna tal cual, alguien registrado como "Admin@correo.co"
   * no podria entrar escribiendo "admin@correo.co", que es lo que va a escribir.
   */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.dataSource
      .getRepository(UserOrmEntity)
      .createQueryBuilder('user')
      .where('lower(user.email) = lower(:email)', { email })
      .getOne()

    return row === null ? null : UserMapper.toDomain(row)
  }

  async save(user: User): Promise<void> {
    await this.dataSource.getRepository(UserOrmEntity).save(UserMapper.toOrm(user))
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.getRepository(UserOrmEntity).delete(id)
  }

  /** Lo pide el invariante de "siempre queda al menos un admin activo". */
  async countActiveAdmins(): Promise<number> {
    return this.dataSource.getRepository(UserOrmEntity).countBy({ role: 'admin', isActive: true })
  }
}
