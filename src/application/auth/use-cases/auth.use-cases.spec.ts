import { Actor, User } from '@/domain/entities'
import { InvalidContentError, UnauthorizedError } from '@/domain/errors'
import type { IHasher, ITokenService, IUserRepository, TokenPayload } from '@/domain/ports'
import { AuthenticateTokenUseCase } from './authenticate-token.usecase'
import { GetCurrentUserUseCase } from './get-current-user.usecase'
import { LoginUseCase } from './login.usecase'

const HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.O0jL2/lVUS/EM6HIL2/D8yfCvSBPfPu'

const user = (overrides: { email?: string; role?: string; isActive?: boolean } = {}): User =>
  User.create({
    id: 'user-1',
    email: overrides.email ?? 'admin@correo.co',
    passwordHash: HASH,
    role: overrides.role ?? 'admin',
    isActive: overrides.isActive ?? true,
  })

class FakeUserRepository implements IUserRepository {
  constructor(private readonly stored: User[] = []) {}

  async findAll(): Promise<User[]> {
    return this.stored
  }

  async findById(id: string): Promise<User | null> {
    return this.stored.find((candidate) => candidate.id === id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return (
      this.stored.find((candidate) => candidate.email.value === email.toLowerCase().trim()) ?? null
    )
  }

  async save(): Promise<void> {}
  async delete(): Promise<void> {}

  async countActiveAdmins(): Promise<number> {
    return this.stored.filter((candidate) => candidate.role.isAdmin && candidate.isActive).length
  }
}

const hasher = (matches: boolean): IHasher => ({
  hash: jest.fn().mockResolvedValue(HASH),
  compare: jest.fn().mockResolvedValue(matches),
})

const tokens = (): ITokenService => ({
  sign: jest.fn().mockResolvedValue({ accessToken: 'token-firmado', expiresIn: 28_800 }),
  verify: jest.fn(),
})

describe('LoginUseCase', () => {
  it('devuelve el token y el usuario publico cuando las credenciales son correctas', async () => {
    const result = await new LoginUseCase(
      new FakeUserRepository([user()]),
      hasher(true),
      tokens(),
    ).execute({ email: 'admin@correo.co', password: 'correcta' })

    expect(result.accessToken).toBe('token-firmado')
    expect(result.expiresIn).toBe(28_800)
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'admin@correo.co',
      role: 'admin',
      isActive: true,
    })
  })

  it('nunca devuelve el hash de la contraseña', async () => {
    const result = await new LoginUseCase(
      new FakeUserRepository([user()]),
      hasher(true),
      tokens(),
    ).execute({ email: 'admin@correo.co', password: 'correcta' })

    expect(JSON.stringify(result)).not.toContain('$2b$')
  })

  it('firma el token con id, correo y rol, y con nada mas', async () => {
    const tokenService = tokens()

    await new LoginUseCase(new FakeUserRepository([user()]), hasher(true), tokenService).execute({
      email: 'admin@correo.co',
      password: 'correcta',
    })

    const signCalls = (tokenService.sign as jest.Mock<unknown, [TokenPayload]>).mock.calls
    const payload = signCalls[0]?.[0] as TokenPayload

    // Lo que viaja en un token viaja en claro: esta firmado, no cifrado.
    expect(Object.keys(payload).sort()).toEqual(['email', 'role', 'sub'])
  })

  it('rechaza una contraseña incorrecta', async () => {
    await expect(
      new LoginUseCase(new FakeUserRepository([user()]), hasher(false), tokens()).execute({
        email: 'admin@correo.co',
        password: 'incorrecta',
      }),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('rechaza un correo que no existe con el MISMO error', async () => {
    // Distinguirlo convertiria el login en un verificador de correos registrados.
    await expect(
      new LoginUseCase(new FakeUserRepository([]), hasher(false), tokens()).execute({
        email: 'nadie@correo.co',
        password: 'cualquiera',
      }),
    ).rejects.toThrow('Credenciales invalidas')
  })

  it('compara contra un hash de descarte cuando el correo no existe', async () => {
    // Sin esto, un correo inexistente responde en un milisegundo y uno registrado
    // en trescientos: esa diferencia se mide y se automatiza.
    const passwordHasher = hasher(false)

    await expect(
      new LoginUseCase(new FakeUserRepository([]), passwordHasher, tokens()).execute({
        email: 'nadie@correo.co',
        password: 'cualquiera',
      }),
    ).rejects.toThrow(UnauthorizedError)

    const compareCalls = (passwordHasher.compare as jest.Mock<unknown, [string, string]>).mock.calls

    expect(compareCalls).toHaveLength(1)
    expect(compareCalls[0]?.[1]).toMatch(/^\$2b\$12\$/)
  })

  it('rechaza a un usuario desactivado aunque acierte la contraseña', async () => {
    await expect(
      new LoginUseCase(
        new FakeUserRepository([user({ isActive: false })]),
        hasher(true),
        tokens(),
      ).execute({ email: 'admin@correo.co', password: 'correcta' }),
    ).rejects.toThrow('Credenciales invalidas')
  })

  it('no emite token para un usuario desactivado', async () => {
    const tokenService = tokens()

    await expect(
      new LoginUseCase(
        new FakeUserRepository([user({ isActive: false })]),
        hasher(true),
        tokenService,
      ).execute({ email: 'admin@correo.co', password: 'correcta' }),
    ).rejects.toThrow()

    expect(tokenService.sign).not.toHaveBeenCalled()
  })

  it('encuentra al usuario aunque el correo llegue con otras mayusculas', async () => {
    const result = await new LoginUseCase(
      new FakeUserRepository([user()]),
      hasher(true),
      tokens(),
    ).execute({ email: '  ADMIN@Correo.CO ', password: 'correcta' })

    expect(result.user.email).toBe('admin@correo.co')
  })
})

describe('AuthenticateTokenUseCase', () => {
  const withPayload = (payload: unknown): ITokenService => ({
    sign: jest.fn(),
    verify: jest.fn().mockResolvedValue(payload),
  })

  it('convierte el payload en el actor que ejecuta la operacion', async () => {
    const actor = await new AuthenticateTokenUseCase(
      withPayload({ sub: 'user-1', email: 'admin@correo.co', role: 'admin' }),
    ).execute('token')

    expect(actor).toBeInstanceOf(Actor)
    expect(actor.toJSON()).toEqual({ id: 'user-1', email: 'admin@correo.co', role: 'admin' })
    expect(actor.isAdmin).toBe(true)
  })

  it('no consulta la base de datos: el token es la fuente de autoridad', () => {
    // El caso de uso no recibe ningun repositorio, y eso es la garantia
    // estructural de la decision de §6.1 del diseño.
    expect(AuthenticateTokenUseCase.length).toBe(1)
  })

  it('propaga el error cuando el token no es valido', async () => {
    const failing: ITokenService = {
      sign: jest.fn(),
      verify: jest.fn().mockRejectedValue(new UnauthorizedError()),
    }

    await expect(new AuthenticateTokenUseCase(failing).execute('roto')).rejects.toThrow(
      UnauthorizedError,
    )
  })

  it('rechaza un payload con un rol que el dominio no conoce', async () => {
    await expect(
      new AuthenticateTokenUseCase(
        withPayload({ sub: 'user-1', email: 'admin@correo.co', role: 'superadmin' }),
      ).execute('token'),
    ).rejects.toThrow(InvalidContentError)
  })
})

describe('GetCurrentUserUseCase', () => {
  const actor = user().toActor()

  it('devuelve los datos frescos del usuario autenticado', async () => {
    const result = await new GetCurrentUserUseCase(new FakeUserRepository([user()])).execute(actor)

    expect(result).toEqual({
      id: 'user-1',
      email: 'admin@correo.co',
      role: 'admin',
      isActive: true,
    })
  })

  it('devuelve el rol REAL, no el que traia el token', async () => {
    // El panel usa esto para decidir que botones mostrar, y ahi importa el estado
    // de ahora: el token puede tener hasta ocho horas.
    const degraded = new FakeUserRepository([user({ role: 'editor' })])

    expect((await new GetCurrentUserUseCase(degraded).execute(actor)).role).toBe('editor')
  })

  it('un token valido de una cuenta borrada es 401', async () => {
    await expect(
      new GetCurrentUserUseCase(new FakeUserRepository([])).execute(actor),
    ).rejects.toThrow(UnauthorizedError)
  })

  it('un token valido de una cuenta desactivada es 401', async () => {
    await expect(
      new GetCurrentUserUseCase(new FakeUserRepository([user({ isActive: false })])).execute(actor),
    ).rejects.toThrow(UnauthorizedError)
  })
})
