import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { PROFILE_ID, type Profile } from '@/domain/entities'
import type { IProfileRepository } from '@/domain/ports'
import { ProfileMapper } from '@/infrastructure/database/mappers'
import { ProfileOrmEntity } from '@/infrastructure/database/orm'

/**
 * El perfil es una sola fila con id fijo.
 *
 * No hay `findAll` ni `delete`: borrar el perfil dejaria el portafolio sin
 * nombre, sin correo y sin secciones, y no hay ninguna operacion del negocio que
 * lo pida.
 */
@Injectable()
export class TypeOrmProfileRepository implements IProfileRepository {
  constructor(private readonly dataSource: DataSource) {}

  async get(): Promise<Profile | null> {
    const row = await this.dataSource.getRepository(ProfileOrmEntity).findOneBy({ id: PROFILE_ID })

    return row === null ? null : ProfileMapper.toDomain(row)
  }

  async save(profile: Profile): Promise<void> {
    await this.dataSource.getRepository(ProfileOrmEntity).save(ProfileMapper.toOrm(profile))
  }
}
