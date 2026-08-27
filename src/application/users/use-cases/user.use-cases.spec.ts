import { Logger } from '@nestjs/common'
import { User, type Actor } from '@/domain/entities'
import {
  EmailAlreadyUsedError,
  ForbiddenActionError,
  LastAdminError,
  NotFoundError,
} from '@/domain/errors'
import type { IHasher, IUserRepository } from '@/domain/ports'
import { EnsureBootstrapAdminUseCase } from './ensure-bootstrap-admin.usecase'
import {
  ChangeUserPasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
} from './user.use-cases'

const HASH = '$2b$12$hashdeprueba'

const user = (
  id: string,
  overrides: { email?: string; role?: string; isActive?: boolean } = {},
): User =>
  User.create({
    id,
    email: overrides.email ?? `${id}@correo.co`,
    passwordHash: HASH,
    role: overrides.role ?? 'admin',
    isActive: overrides.isActive ?? true,
  })

class FakeUserRepository implements IUserRepository {
  constructor(public stored: User[] = []) {}

  async findAll(): Promise<User[]> {
    return [...this.stored]
  }

  async findById(id: string): Promise<User | null> {
    return this.stored.find((candidate) => candidate.id === id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return (
      this.stored.find((candidate) => candidate.email.value === email.toLowerCase().trim()) ?? null
    )
  }

  async save(user: User): Promise<void> {
    const index = this.stored.findIndex((candidate) => candidate.id === user.id)

    if (index === -1) this.stored.push(user)
    else this.stored[index] = user
  }

  async delete(id: string): Promise<void> {
    this.stored = this.stored.filter((candidate) => candidate.id !== id)
  }

  async countActiveAdmins(): Promise<number> {
    return this.stored.filter((candidate) => candidate.role.isAdmin && candidate.isActive).length
  }
}

const hasher = (): IHasher => ({
  hash: jest.fn().mockResolvedValue(HASH),
  compare: jest.fn().mockResolvedValue(true),
})

const admin: Actor = user('admin-1').toActor()
const editor: Actor = user('editor-1', { role: 'editor' }).toActor()

describe('administracion de usuarios', () => {
  let repository: FakeUserRepository

  beforeEach(() => {
    repository = new FakeUserRepository([user('admin-1'), user('editor-1', { role: 'editor' })])
  })

  describe('permisos: un editor no administra usuarios', () => {
    it('no puede listar', async () => {
      await expect(new ListUsersUseCase(repository).execute(editor)).rejects.toThrow(
        ForbiddenActionError,
      )
    })

    it('no puede crear', async () => {
      await expect(
        new CreateUserUseCase(repository, hasher()).execute(editor, {
          email: 'nuevo@correo.co',
          password: 'secreta',
          role: 'editor',
        }),
      ).rejects.toThrow(ForbiddenActionError)
    })

    it('no puede modificar', async () => {
      await expect(
        new UpdateUserUseCase(repository).execute(editor, 'admin-1', { isActive: false }),
      ).rejects.toThrow(ForbiddenActionError)
    })

    it('no puede cambiar contraseñas', async () => {
      await expect(
        new ChangeUserPasswordUseCase(repository, hasher()).execute(editor, 'admin-1', 'nueva'),
      ).rejects.toThrow(ForbiddenActionError)
    })

    it('no puede borrar', async () => {
      await expect(new DeleteUserUseCase(repository).execute(editor, 'admin-1')).rejects.toThrow(
        ForbiddenActionError,
      )
    })

    it('y nada cambio en el intento', async () => {
      await expect(new DeleteUserUseCase(repository).execute(editor, 'admin-1')).rejects.toThrow()

      expect(repository.stored).toHaveLength(2)
    })
  })

  describe('listar', () => {
    it('devuelve la forma publica, sin hashes', async () => {
      const result = await new ListUsersUseCase(repository).execute(admin)

      expect(result).toHaveLength(2)
      expect(JSON.stringify(result)).not.toContain(HASH)
      expect(Object.keys(result[0] ?? {}).sort()).toEqual(['email', 'id', 'isActive', 'role'])
    })
  })

  describe('crear', () => {
    it('hashea la contraseña y no la devuelve', async () => {
      const passwordHasher = hasher()

      const created = await new CreateUserUseCase(repository, passwordHasher).execute(admin, {
        email: 'nuevo@correo.co',
        password: 'secreta',
        role: 'editor',
      })

      expect(passwordHasher.hash).toHaveBeenCalledWith('secreta')
      expect(created).toEqual({
        id: expect.any(String) as string,
        email: 'nuevo@correo.co',
        role: 'editor',
        isActive: true,
      })
    })

    it('rechaza un correo ya registrado', async () => {
      await expect(
        new CreateUserUseCase(repository, hasher()).execute(admin, {
          email: 'admin-1@correo.co',
          password: 'secreta',
          role: 'editor',
        }),
      ).rejects.toThrow(EmailAlreadyUsedError)
    })

    it('rechaza un correo repetido con otras mayusculas', async () => {
      await expect(
        new CreateUserUseCase(repository, hasher()).execute(admin, {
          email: 'ADMIN-1@Correo.CO',
          password: 'secreta',
          role: 'editor',
        }),
      ).rejects.toThrow(EmailAlreadyUsedError)
    })

    it('no gasta un hasheo cuando el correo ya esta tomado', async () => {
      // Hashear cuesta ~300 ms a proposito; no hay razon para pagarlos.
      const passwordHasher = hasher()

      await expect(
        new CreateUserUseCase(repository, passwordHasher).execute(admin, {
          email: 'admin-1@correo.co',
          password: 'secreta',
          role: 'editor',
        }),
      ).rejects.toThrow()

      expect(passwordHasher.hash).not.toHaveBeenCalled()
    })

    it('rechaza un rol inventado', async () => {
      await expect(
        new CreateUserUseCase(repository, hasher()).execute(admin, {
          email: 'nuevo@correo.co',
          password: 'secreta',
          role: 'superadmin',
        }),
      ).rejects.toThrow(/no es un rol valido/)
    })
  })

  describe('modificar', () => {
    it('cambia el rol', async () => {
      repository = new FakeUserRepository([user('admin-1'), user('admin-2')])

      const updated = await new UpdateUserUseCase(repository).execute(admin, 'admin-2', {
        role: 'editor',
      })

      expect(updated.role).toBe('editor')
    })

    it('desactiva', async () => {
      repository = new FakeUserRepository([user('admin-1'), user('admin-2')])

      const updated = await new UpdateUserUseCase(repository).execute(admin, 'admin-2', {
        isActive: false,
      })

      expect(updated.isActive).toBe(false)
    })

    it('reactiva', async () => {
      repository = new FakeUserRepository([user('admin-1'), user('x', { isActive: false })])

      const updated = await new UpdateUserUseCase(repository).execute(admin, 'x', {
        isActive: true,
      })

      expect(updated.isActive).toBe(true)
    })

    it('lanza NotFoundError si el usuario no existe', async () => {
      await expect(
        new UpdateUserUseCase(repository).execute(admin, 'fantasma', { isActive: false }),
      ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
    })
  })

  describe('el invariante del ultimo administrador', () => {
    beforeEach(() => {
      // Un solo admin activo, mas un editor que no cuenta.
      repository = new FakeUserRepository([user('admin-1'), user('editor-1', { role: 'editor' })])
    })

    it('no deja degradar al ultimo admin', async () => {
      await expect(
        new UpdateUserUseCase(repository).execute(admin, 'admin-1', { role: 'editor' }),
      ).rejects.toThrow(LastAdminError)
    })

    it('no deja desactivar al ultimo admin', async () => {
      await expect(
        new UpdateUserUseCase(repository).execute(admin, 'admin-1', { isActive: false }),
      ).rejects.toThrow(LastAdminError)
    })

    it('no deja borrar al ultimo admin', async () => {
      await expect(new DeleteUserUseCase(repository).execute(admin, 'admin-1')).rejects.toThrow(
        LastAdminError,
      )
    })

    it('y el usuario sigue ahi despues del intento', async () => {
      await expect(new DeleteUserUseCase(repository).execute(admin, 'admin-1')).rejects.toThrow()

      expect(await repository.findById('admin-1')).not.toBeNull()
    })

    it('con dos admins activos si permite degradar a uno', async () => {
      repository = new FakeUserRepository([user('admin-1'), user('admin-2')])

      await expect(
        new UpdateUserUseCase(repository).execute(admin, 'admin-2', { role: 'editor' }),
      ).resolves.toMatchObject({ role: 'editor' })
    })

    it('un admin ya desactivado no cuenta como el ultimo', async () => {
      repository = new FakeUserRepository([user('admin-1'), user('admin-2', { isActive: false })])

      await expect(
        new DeleteUserUseCase(repository).execute(admin, 'admin-2'),
      ).resolves.toBeUndefined()
    })

    it('borrar a un editor nunca toca el invariante', async () => {
      await expect(
        new DeleteUserUseCase(repository).execute(admin, 'editor-1'),
      ).resolves.toBeUndefined()
    })

    it('cambiar el rol de admin a admin no dispara el invariante', async () => {
      // No es un cambio: exigir un segundo admin aqui seria bloquear una
      // operacion que no reduce nada.
      await expect(
        new UpdateUserUseCase(repository).execute(admin, 'admin-1', { role: 'admin' }),
      ).resolves.toMatchObject({ role: 'admin' })
    })
  })

  describe('cambiar contraseña', () => {
    it('guarda el hash nuevo y devuelve la forma publica', async () => {
      const passwordHasher = hasher()

      const result = await new ChangeUserPasswordUseCase(repository, passwordHasher).execute(
        admin,
        'editor-1',
        'nueva-contrasena',
      )

      expect(passwordHasher.hash).toHaveBeenCalledWith('nueva-contrasena')
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('falla si el usuario no existe', async () => {
      await expect(
        new ChangeUserPasswordUseCase(repository, hasher()).execute(admin, 'fantasma', 'x'),
      ).rejects.toThrow(NotFoundError)
    })
  })
})

describe('EnsureBootstrapAdminUseCase', () => {
  const credentials = { email: 'admin@portafolio.local', passwordHash: HASH }

  it('crea el primer admin cuando la base esta vacia', async () => {
    const repository = new FakeUserRepository([])

    await expect(new EnsureBootstrapAdminUseCase(repository).execute(credentials)).resolves.toBe(
      'created',
    )
    expect(repository.stored[0]?.role.isAdmin).toBe(true)
    expect(repository.stored[0]?.email.value).toBe('admin@portafolio.local')
  })

  it('no hace nada si ya existe un admin activo, ni siquiera si el hash cambio', async () => {
    // El seed es idempotente: reiniciar el servidor no puede revertir un cambio
    // de contraseña hecho por API.
    const repository = new FakeUserRepository([user('admin-1')])

    await expect(
      new EnsureBootstrapAdminUseCase(repository).execute({
        email: 'otro@correo.co',
        passwordHash: '$2b$12$otrohash',
      }),
    ).resolves.toBe('already-exists')

    expect(repository.stored).toHaveLength(1)
    expect(repository.stored[0]?.email.value).toBe('admin-1@correo.co')
  })

  it('avisa y sigue cuando no hay credenciales configuradas', async () => {
    // No revienta el arranque: la lectura publica del portafolio funciona igual.
    // Lo que no puede pasar es que falle en silencio.
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)

    await expect(
      new EnsureBootstrapAdminUseCase(new FakeUserRepository([])).execute(null),
    ).resolves.toBe('not-configured')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NADIE puede'))
  })

  it('crea el admin si el unico que existe esta desactivado', async () => {
    // Es el escenario de bloqueo: sin esto, desactivar al unico admin dejaria el
    // sistema inadministrable incluso reiniciando con credenciales validas.
    const repository = new FakeUserRepository([user('admin-1', { isActive: false })])

    await expect(new EnsureBootstrapAdminUseCase(repository).execute(credentials)).resolves.toBe(
      'created',
    )
    expect(repository.stored).toHaveLength(2)
  })
})
