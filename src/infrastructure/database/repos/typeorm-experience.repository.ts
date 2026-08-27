import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { ExperienceItem } from '@/domain/entities'
import type { IExperienceRepository } from '@/domain/ports'
import { ExperienceMapper } from '@/infrastructure/database/mappers'
import { ExperienceOrmEntity } from '@/infrastructure/database/orm'
import { TypeOrmOrderedRepository } from './typeorm-ordered.repository'

@Injectable()
export class TypeOrmExperienceRepository
  extends TypeOrmOrderedRepository<ExperienceItem, ExperienceOrmEntity>
  implements IExperienceRepository
{
  constructor(dataSource: DataSource) {
    super(dataSource, ExperienceOrmEntity, ExperienceMapper)
  }
}
