import { SetMetadata } from '@nestjs/common'
import type { RoleName } from '@/domain/value-objects/role'

export const ROLES_METADATA = 'roles'

/**
 * Declara que roles pueden entrar a una ruta.
 *
 * Es obligatorio en todo lo que este bajo `/v1/admin`: `RolesGuard` DENIEGA
 * cuando el decorador falta, asi que olvidarlo produce un 403 molesto en vez de
 * un endpoint abierto.
 */
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_METADATA, roles)
