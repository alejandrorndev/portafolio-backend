import {
  DomainError,
  DuplicateSlugError,
  EmailAlreadyUsedError,
  ForbiddenActionError,
  InvalidContentError,
  LastAdminError,
  NotFoundError,
  UnauthorizedError,
} from './index'

describe('errores de dominio', () => {
  it('todos son DomainError y Error, para que el filtro los reconozca', () => {
    const errors = [
      new InvalidContentError('x'),
      new NotFoundError('project', 'a'),
      new DuplicateSlugError('project', 'a'),
      new ForbiddenActionError('borrar'),
      new UnauthorizedError(),
      new EmailAlreadyUsedError('a@b.co'),
      new LastAdminError('degradar'),
    ]

    for (const error of errors) {
      expect(error).toBeInstanceOf(DomainError)
      expect(error).toBeInstanceOf(Error)
      expect(error.code).toMatch(/^[A-Z0-9_]+$/)
      expect(error.name).toBe(error.constructor.name)
      expect(error.message.length).toBeGreaterThan(0)
    }
  })

  it('NotFoundError compone el codigo con el recurso', () => {
    expect(new NotFoundError('project', 'api-rest').code).toBe('PROJECT_NOT_FOUND')
    expect(new NotFoundError('skill category', 'backend').code).toBe('SKILL_CATEGORY_NOT_FOUND')
  })

  it('UnauthorizedError no revela si el correo existe', () => {
    // El mensaje por defecto es deliberadamente ambiguo: distinguir "no existe"
    // de "contraseña incorrecta" convierte el login en un verificador de
    // correos registrados.
    expect(new UnauthorizedError().message).toBe('Credenciales invalidas')
  })

  it('conserva los datos que el consumidor puede necesitar', () => {
    expect(new NotFoundError('project', 'a').id).toBe('a')
    expect(new DuplicateSlugError('project', 'a').resource).toBe('project')
    expect(new EmailAlreadyUsedError('A@b.co').email).toBe('A@b.co')
  })
})
