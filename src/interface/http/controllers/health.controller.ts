import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CheckDatabaseHealthUseCase } from '@/application/health/use-cases/check-database-health.usecase'

/*
 * -----------------------------------------------------------------------------
 * Dos chequeos de salud, y la diferencia importa.
 * -----------------------------------------------------------------------------
 * `/health` NO toca la base de datos. Es el que golpea el keepalive cada 12
 * minutos para que Render no duerma el servicio; si consultara Postgres,
 * mantendria la conexion viva de forma permanente, y con algunos proveedores
 * (Neon) eso quema la cuota mensual de horas de computo.
 *
 * `/health/db` existe para el chequeo diario que si necesita despertar la base
 * de datos: es lo que evita que Supabase pause el proyecto por 7 dias de
 * inactividad.
 * -----------------------------------------------------------------------------
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly checkDatabase: CheckDatabaseHealthUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'El proceso vive',
    description:
      'NO consulta la base de datos. Es el endpoint del keepalive: si consultara ' +
      'Postgres, mantendria la conexion viva de forma permanente.',
  })
  @ApiResponse({ status: 200, description: 'El proceso responde' })
  live(): { status: 'ok' } {
    return { status: 'ok' }
  }

  @Get('db')
  @ApiOperation({
    summary: 'La base de datos responde',
    description:
      'Ejecuta un SELECT 1. Lo usa el chequeo diario que evita que el proveedor ' +
      'de Postgres pause el proyecto por inactividad.',
  })
  @ApiResponse({ status: 200, description: 'La base de datos responde' })
  @ApiResponse({ status: 503, description: 'La base de datos no responde' })
  async ready(): Promise<{ status: 'ok' }> {
    if (!(await this.checkDatabase.execute())) {
      throw new ServiceUnavailableException('La base de datos no responde')
    }

    return { status: 'ok' }
  }
}
