import { InvalidContentError, UnauthorizedError } from '@/domain/errors'
import { Role } from '@/domain/value-objects/role'
import { User, type PublicUser } from './user.entity'

const input = {
  email: 'admin@correo.co',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuv',
  role: 'admin',
}

describe('User', () => {
  it('genera el id cuando no se da y lo respeta cuando si', () => {
    expect(User.create(input).id).toMatch(/^[0-9a-f-]{36}$/)
    expect(User.create({ ...input, id: 'fijo' }).id).toBe('fijo')
  })

  it('nace activo salvo que se diga lo contrario', () => {
    expect(User.create(input).isActive).toBe(true)
    expect(User.create({ ...input, isActive: false }).isActive).toBe(false)
  })

  it('rechaza un hash vacio', () => {
    // Un hash vacio convertiria el login en "cualquier contraseña sirve".
    expect(() => User.create({ ...input, passwordHash: '' })).toThrow(InvalidContentError)
  })

  it('rechaza un rol invalido', () => {
    expect(() => User.create({ ...input, role: 'viewer' })).toThrow(/no es un rol valido/)
  })

  it('normaliza el correo', () => {
    expect(User.create({ ...input, email: ' Admin@Correo.CO ' }).email.value).toBe(
      'admin@correo.co',
    )
  })

  describe('toActor', () => {
    it('produce la identidad que los casos de uso usan para autorizar', () => {
      const actor = User.create({ ...input, id: 'fijo' }).toActor()

      expect(actor.toJSON()).toEqual({ id: 'fijo', email: 'admin@correo.co', role: 'admin' })
    })

    it('el actor conserva los permisos del rol', () => {
      expect(User.create(input).toActor().isAdmin).toBe(true)
      expect(User.create({ ...input, role: 'editor' }).toActor().isAdmin).toBe(false)
    })

    it('no lleva el hash de la contraseña a ninguna parte', () => {
      expect(JSON.stringify(User.create(input).toActor())).not.toContain('$2b$')
    })
  })

  describe('login', () => {
    it('un usuario activo puede entrar', () => {
      expect(() => User.create(input).ensureCanLogin()).not.toThrow()
    })

    it('un usuario desactivado no entra, y el error no lo delata', () => {
      const disabled = User.create({ ...input, isActive: false })

      expect(() => disabled.ensureCanLogin()).toThrow(UnauthorizedError)
      // Decir "tu cuenta esta desactivada" le confirma a quien prueba correos
      // ajenos que ese correo existe.
      expect(() => disabled.ensureCanLogin()).toThrow('Credenciales invalidas')
    })
  })

  describe('cambios', () => {
    it('withRole devuelve una copia con el rol nuevo', () => {
      const admin = User.create(input)
      const degraded = admin.withRole(Role.EDITOR)

      expect(degraded.role).toBe(Role.EDITOR)
      expect(admin.role).toBe(Role.ADMIN)
    })

    it('withPasswordHash valida el hash nuevo', () => {
      expect(User.create(input).withPasswordHash('$2b$12$nuevo').passwordHash).toBe('$2b$12$nuevo')
      expect(() => User.create(input).withPasswordHash('  ')).toThrow(InvalidContentError)
    })

    it('activate y deactivate no tocan nada mas', () => {
      const user = User.create(input)
      const disabled = user.deactivate()

      expect(disabled.isActive).toBe(false)
      expect(disabled.id).toBe(user.id)
      expect(disabled.activate().isActive).toBe(true)
    })
  })

  it('toPublic nunca expone el hash', () => {
    const publicUser: PublicUser = User.create(input).toPublic()

    // Se afirma el conjunto EXACTO de claves y no solo la ausencia del hash: si
    // mañana se agrega un campo sensible a la entidad, este test falla y obliga a
    // decidir si debe salir al mundo.
    expect(Object.keys(publicUser).sort()).toEqual(['email', 'id', 'isActive', 'role'])
    expect(publicUser.email).toBe('admin@correo.co')
    expect(publicUser.role).toBe('admin')
    expect(publicUser.isActive).toBe(true)
    expect(publicUser.id).toHaveLength(36)
  })

  it('toPrimitives si lo incluye, porque es lo que la base de datos guarda', () => {
    expect(User.create(input).toPrimitives().passwordHash).toBe(input.passwordHash)
  })
})
