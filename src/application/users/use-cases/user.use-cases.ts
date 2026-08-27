import { Inject, Injectable } from '@nestjs/common'
import { User, type Actor, type PublicUser } from '@/domain/entities'
import { EmailAlreadyUsedError, LastAdminError, NotFoundError } from '@/domain/errors'
import { HASHER, USER_REPOSITORY, type IHasher, type IUserRepository } from '@/domain/ports'
import { Role } from '@/domain/value-objects/role'

/*
 * -----------------------------------------------------------------------------
 * Administracion de usuarios. Solo para admins.
 * -----------------------------------------------------------------------------
 * Cada caso de uso empieza pidiendole permiso al actor. Eso duplica lo que el
 * `RolesGuard` ya hizo en HTTP, y es deliberado: el guard protege el transporte,
 * y esta comprobacion protege la regla — el mismo caso de uso puede invocarse
 * desde un script o desde el bootstrap, donde no hay guard.
 *
 * El invariante que atraviesa todo el archivo: SIEMPRE queda al menos un admin
 * activo. Sin el, un clic desafortunado deja el sistema sin nadie que pueda
 * administrarlo y la unica salida es un UPDATE a mano en la base de datos.
 * -----------------------------------------------------------------------------
 */

export interface CreateUserInput {
  email: string
  password: string
  role: string
}

export interface UpdateUserInput {
  role?: string
  isActive?: boolean
}

abstract class AdminUseCase {
  protected constructor(protected readonly users: IUserRepository) {}

  protected async load(id: string): Promise<User> {
    const user = await this.users.findById(id)

    if (user === null) throw new NotFoundError('user', id)

    return user
  }

  /**
   * Falla si el cambio dejaria el sistema sin administradores activos.
   *
   * Solo mira la cuenta cuando de verdad es un admin activo: degradar a un editor
   * o desactivar a un admin ya inactivo no reduce el numero de administradores.
   */
  protected async ensureNotLastAdmin(target: User, action: string): Promise<void> {
    if (!target.role.isAdmin || !target.isActive) return

    if ((await this.users.countActiveAdmins()) <= 1) {
      throw new LastAdminError(action)
    }
  }
}

@Injectable()
export class ListUsersUseCase extends AdminUseCase {
  constructor(@Inject(USER_REPOSITORY) users: IUserRepository) {
    super(users)
  }

  async execute(actor: Actor): Promise<PublicUser[]> {
    actor.ensureCanManageUsers('listar usuarios')

    const users = await this.users.findAll()

    // `toPublic` y no `toPrimitives`: una lista de usuarios que incluye hashes es
    // una filtracion esperando un endpoint que la devuelva.
    return users.map((user) => user.toPublic())
  }
}

@Injectable()
export class CreateUserUseCase extends AdminUseCase {
  constructor(
    @Inject(USER_REPOSITORY) users: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
  ) {
    super(users)
  }

  async execute(actor: Actor, input: CreateUserInput): Promise<PublicUser> {
    actor.ensureCanManageUsers('crear usuarios')

    // Se comprueba antes de hashear: hashear cuesta ~300 ms a proposito, y no
    // hay razon para pagarlos si el correo ya esta tomado.
    if ((await this.users.findByEmail(input.email)) !== null) {
      throw new EmailAlreadyUsedError(input.email)
    }

    const user = User.create({
      email: input.email,
      // La contraseña en claro no se guarda, ni se registra, ni se devuelve:
      // entra por aqui, sale convertida en hash y se olvida.
      passwordHash: await this.hasher.hash(input.password),
      role: input.role,
    })

    await this.users.save(user)

    return user.toPublic()
  }
}

@Injectable()
export class UpdateUserUseCase extends AdminUseCase {
  constructor(@Inject(USER_REPOSITORY) users: IUserRepository) {
    super(users)
  }

  async execute(actor: Actor, id: string, changes: UpdateUserInput): Promise<PublicUser> {
    actor.ensureCanManageUsers('modificar usuarios')

    const current = await this.load(id)

    const degrades = changes.role !== undefined && changes.role !== current.role.name
    const deactivates = changes.isActive === false && current.isActive

    if (degrades || deactivates) {
      await this.ensureNotLastAdmin(current, deactivates ? 'desactivarlo' : 'cambiarle el rol')
    }

    let updated = current

    if (changes.role !== undefined) updated = updated.withRole(Role.of(changes.role, 'role'))
    if (changes.isActive !== undefined) {
      updated = changes.isActive ? updated.activate() : updated.deactivate()
    }

    await this.users.save(updated)

    return updated.toPublic()
  }
}

@Injectable()
export class ChangeUserPasswordUseCase extends AdminUseCase {
  constructor(
    @Inject(USER_REPOSITORY) users: IUserRepository,
    @Inject(HASHER) private readonly hasher: IHasher,
  ) {
    super(users)
  }

  async execute(actor: Actor, id: string, password: string): Promise<PublicUser> {
    actor.ensureCanManageUsers('cambiar contraseñas')

    const user = await this.load(id)
    const updated = user.withPasswordHash(await this.hasher.hash(password))

    await this.users.save(updated)

    return updated.toPublic()
  }
}

@Injectable()
export class DeleteUserUseCase extends AdminUseCase {
  constructor(@Inject(USER_REPOSITORY) users: IUserRepository) {
    super(users)
  }

  async execute(actor: Actor, id: string): Promise<void> {
    actor.ensureCanManageUsers('borrar usuarios')

    const user = await this.load(id)

    await this.ensureNotLastAdmin(user, 'borrarlo')

    await this.users.delete(id)
  }
}
