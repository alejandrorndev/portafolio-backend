import type { User } from '@/domain/entities'

export interface IUserRepository {
  findAll(): Promise<User[]>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  save(user: User): Promise<void>
  delete(id: string): Promise<void>

  /**
   * Cuantos administradores activos hay.
   *
   * Lo pide el invariante de "siempre queda al menos un admin activo": sin este
   * conteo, comprobarlo obligaria a traer todos los usuarios a memoria para
   * filtrarlos.
   */
  countActiveAdmins(): Promise<number>
}

export const USER_REPOSITORY = 'IUserRepository'
