import { Module } from '@nestjs/common'
import { CheckDatabaseHealthUseCase } from '@/application/health/use-cases/check-database-health.usecase'
import { HealthController } from '@/interface/http/controllers/health.controller'
import { DatabaseModule } from './database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [CheckDatabaseHealthUseCase],
})
export class HealthModule {}
