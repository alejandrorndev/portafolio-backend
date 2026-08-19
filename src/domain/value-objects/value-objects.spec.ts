import { InvalidContentError } from '@/domain/errors'
import { parseAccent } from './accent'
import { Email } from './email'
import { Gradient } from './gradient'
import { HexColor } from './hex-color'
import { DEFAULT_LOCALE, isLocale, parseLocale } from './locale'
import { Period } from './period'
import { ProjectLinks } from './project-links'
import { Role } from './role'
import { Slug } from './slug'

describe('Slug', () => {
  it.each(['api-rest-eventos', 'backend', 'carrito-compras-js', 'a1-b2'])(
    'acepta "%s"',
    (value) => {
      expect(Slug.of(value).value).toBe(value)
    },
  )

  it.each([
    ['mayusculas', 'API-Rest'],
    ['espacios', 'api rest'],
    ['guion al final', 'api-'],
    ['guion doble', 'api--rest'],
    ['guion bajo', 'api_rest'],
    ['vacio', ''],
    ['acentos', 'año-nuevo'],
    ['no es texto', 42],
  ])('rechaza %s', (_label, value) => {
    expect(() => Slug.of(value)).toThrow(InvalidContentError)
  })

  it('compara por valor y se imprime como texto', () => {
    expect(Slug.of('backend').equals(Slug.of('backend'))).toBe(true)
    expect(Slug.of('backend').equals(Slug.of('frontend'))).toBe(false)
    expect(Slug.of('backend').toString()).toBe('backend')
  })
})

describe('HexColor', () => {
  it('normaliza a minusculas para no guardar el mismo color dos veces', () => {
    expect(HexColor.of('#7C3AED').value).toBe('#7c3aed')
  })

  it.each([['#fff'], ['7c3aed'], ['#7c3ae'], ['#7c3aedd'], ['#zzzzzz'], [null]])(
    'rechaza %s',
    (value) => {
      expect(() => HexColor.of(value)).toThrow(InvalidContentError)
    },
  )

  it('compara por valor ignorando el caso original', () => {
    expect(HexColor.of('#FFF000').equals(HexColor.of('#fff000'))).toBe(true)
    expect(HexColor.of('#FFF000').toString()).toBe('#fff000')
  })
})

describe('Gradient', () => {
  it('acepta una tupla de dos colores y la devuelve igual', () => {
    expect(Gradient.of(['#7c3aed', '#06B6D4']).toJSON()).toEqual(['#7c3aed', '#06b6d4'])
  })

  it('se construye desde las dos columnas de la base de datos', () => {
    expect(Gradient.fromColumns('#000000', '#ffffff').toJSON()).toEqual(['#000000', '#ffffff'])
  })

  it.each([
    ['un solo color', ['#7c3aed']],
    ['tres colores', ['#7c3aed', '#06b6d4', '#000000']],
    ['no es un array', { from: '#7c3aed' }],
  ])('rechaza %s', (_label, value) => {
    expect(() => Gradient.of(value)).toThrow(/dos colores/)
  })

  it('senala cual de los dos colores esta mal', () => {
    expect(() => Gradient.of(['#7c3aed', 'azul'])).toThrow(/gradient\[1\]/)
  })
})

describe('ProjectLinks', () => {
  it('acepta solo demo', () => {
    expect(ProjectLinks.of({ demo: 'https://demo.co' }).toJSON()).toEqual({
      demo: 'https://demo.co',
    })
  })

  it('acepta solo github', () => {
    expect(ProjectLinks.of({ github: 'https://github.com/a/b' }).toJSON()).toEqual({
      github: 'https://github.com/a/b',
    })
  })

  it('omite las claves ausentes en vez de devolver null, como el front espera', () => {
    expect(ProjectLinks.of({ demo: 'https://demo.co' }).toJSON()).not.toHaveProperty('github')
  })

  it('rechaza un proyecto sin ningun enlace', () => {
    // Es justo lo que un reclutador va a querer abrir.
    expect(() => ProjectLinks.of({})).toThrow(/al menos un enlace/)
    expect(() => ProjectLinks.of({ demo: null, github: '' })).toThrow(/al menos un enlace/)
  })

  it('trata un github explicitamente nulo igual que ausente', () => {
    expect(ProjectLinks.of({ demo: 'https://demo.co', github: null }).toJSON()).toEqual({
      demo: 'https://demo.co',
    })
  })

  it('rechaza http, que el navegador bloquearia en una pagina https', () => {
    expect(() => ProjectLinks.of({ demo: 'http://demo.co' })).toThrow(/debe usar https/)
  })

  it('rechaza un enlace que no es texto', () => {
    expect(() => ProjectLinks.of({ demo: 42 })).toThrow(/se esperaba una URL/)
  })

  it('rechaza lo que no es un objeto', () => {
    expect(() => ProjectLinks.of('https://demo.co')).toThrow(/se esperaba un objeto/)
  })
})

describe('Period', () => {
  it('con end nulo esta en curso', () => {
    const period = Period.of({ start: '2024', end: null })

    expect(period.isCurrent).toBe(true)
    expect(period.toJSON()).toEqual({ start: '2024', end: null })
  })

  it('con end presente no esta en curso', () => {
    expect(Period.of({ start: '2022', end: '2024' }).isCurrent).toBe(false)
  })

  it('trata end ausente igual que null', () => {
    expect(Period.of({ start: '2024' }).isCurrent).toBe(true)
  })

  it('recorta las etiquetas', () => {
    expect(Period.of({ start: ' Ene 2024 ', end: ' Dic 2024 ' }).toJSON()).toEqual({
      start: 'Ene 2024',
      end: 'Dic 2024',
    })
  })

  it.each([
    ['start ausente', {}],
    ['start vacio', { start: '   ' }],
    ['start no es texto', { start: 2024 }],
  ])('rechaza %s', (_label, value) => {
    expect(() => Period.of(value)).toThrow(/start es obligatorio/)
  })

  it('rechaza un end vacio: o es una etiqueta o es null', () => {
    expect(() => Period.of({ start: '2024', end: '  ' })).toThrow(/end debe ser una etiqueta/)
  })

  it('rechaza lo que no es un objeto', () => {
    expect(() => Period.of('2024')).toThrow(/se esperaba un objeto/)
  })
})

describe('Role', () => {
  it('un admin puede todo', () => {
    const admin = Role.of('admin')

    expect(admin.isAdmin).toBe(true)
    expect(admin.canWriteContent()).toBe(true)
    expect(admin.canDeleteContent()).toBe(true)
    expect(admin.canManageUsers()).toBe(true)
  })

  it('un editor escribe pero no borra ni administra usuarios', () => {
    const editor = Role.of('editor')

    expect(editor.isAdmin).toBe(false)
    expect(editor.canWriteContent()).toBe(true)
    expect(editor.canDeleteContent()).toBe(false)
    expect(editor.canManageUsers()).toBe(false)
  })

  it('devuelve siempre la misma instancia por rol', () => {
    expect(Role.of('admin')).toBe(Role.ADMIN)
    expect(Role.of('editor')).toBe(Role.EDITOR)
  })

  it.each(['viewer', 'ADMIN', '', null, 42])('rechaza el rol %s', (value) => {
    expect(() => Role.of(value)).toThrow(InvalidContentError)
  })

  it('compara por nombre y se imprime como texto', () => {
    expect(Role.ADMIN.equals(Role.of('admin'))).toBe(true)
    expect(Role.ADMIN.equals(Role.EDITOR)).toBe(false)
    expect(Role.EDITOR.toString()).toBe('editor')
  })
})

describe('Email', () => {
  it('normaliza a minusculas y recorta', () => {
    // Sin esto, Admin@correo.co y admin@correo.co serian dos cuentas.
    expect(Email.of('  Admin@Correo.CO ').value).toBe('admin@correo.co')
  })

  it.each(['sin-arroba', 'a@b', 'a@b.c', '@correo.co', 'a b@correo.co', ''])(
    'rechaza "%s"',
    (value) => {
      expect(() => Email.of(value)).toThrow(/no parece un correo valido/)
    },
  )

  it('rechaza lo que no es texto', () => {
    expect(() => Email.of(42)).toThrow(/se esperaba texto/)
  })

  it('compara ignorando mayusculas por la normalizacion', () => {
    expect(Email.of('A@correo.co').equals(Email.of('a@correo.co'))).toBe(true)
    expect(Email.of('a@correo.co').toString()).toBe('a@correo.co')
  })
})

describe('locale', () => {
  it('reconoce los idiomas del sitio', () => {
    expect(isLocale('es')).toBe(true)
    expect(isLocale('en')).toBe(true)
    expect(isLocale('fr')).toBe(false)
    expect(isLocale(42)).toBe(false)
  })

  it('el idioma por defecto es el español, igual que en el front', () => {
    expect(DEFAULT_LOCALE).toBe('es')
  })

  it('parseLocale falla en vez de caer a un idioma por defecto', () => {
    // Si alguien pide "fr", la respuesta correcta es decirle que no existe: un
    // fallback silencioso le devolveria español creyendo que pidio frances.
    expect(() => parseLocale('fr')).toThrow(/Idioma no soportado/)
    expect(parseLocale('en')).toBe('en')
  })
})

describe('accent', () => {
  it.each(['purple', 'cyan', 'pink', 'gold'])('acepta %s', (value) => {
    expect(parseAccent(value)).toBe(value)
  })

  it.each(['red', 'PURPLE', '', null])('rechaza %s', (value) => {
    expect(() => parseAccent(value)).toThrow(/no es un acento valido/)
  })
})
