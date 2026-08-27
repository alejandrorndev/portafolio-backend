import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { Project } from '@/domain/entities'
import type { IProjectRepository } from '@/domain/ports'
import { ProjectMapper } from '@/infrastructure/database/mappers'
import { ProjectOrmEntity } from '@/infrastructure/database/orm'
import { TypeOrmOrderedRepository } from './typeorm-ordered.repository'

@Injectable()
export class TypeOrmProjectRepository
  extends TypeOrmOrderedRepository<Project, ProjectOrmEntity>
  implements IProjectRepository
{
  constructor(dataSource: DataSource) {
    super(dataSource, ProjectOrmEntity, ProjectMapper)
  }
}
