import { ROLES, type RoleName } from '@/domain/value-objects/role'

/**
 * Comprueba que el rol del payload de un token es uno de los conocidos.
 *
 * Un token firmado con un rol inventado —o con uno que existia y se elimino—
 * tiene que rechazarse, no colarse como un rol vacio con permisos indefinidos.
 */
export function isKnownRole(value: unknown): value is RoleName {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
