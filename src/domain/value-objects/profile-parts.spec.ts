import { SocialLink } from './social-link'
import { Stat } from './stat'

describe('SocialLink', () => {
  const valid = { id: 'github', label: 'GitHub', href: 'https://github.com/a', icon: 'gh' }

  it('acepta un enlace completo', () => {
    expect(SocialLink.of({ ...valid, position: 2 }).toJSON()).toEqual({
      id: 'github',
      label: 'GitHub',
      href: 'https://github.com/a',
      icon: 'gh',
      position: 2,
    })
  })

  it('sin position, asume la primera', () => {
    expect(SocialLink.of(valid).position).toBe(0)
  })

  it.each([null, undefined, ''])('trata el icono %s como sin icono', (icon) => {
    expect(SocialLink.of({ ...valid, icon }).icon).toBeNull()
  })

  it('acepta un mailto, que un proyecto no aceptaria', () => {
    // El perfil incluye el correo directo; forzar https ahi romperia el unico
    // enlace que el visitante puede abrir en su cliente de correo.
    expect(SocialLink.of({ ...valid, href: 'mailto:a@b.co' }).href).toBe('mailto:a@b.co')
  })

  it('exige id, label y href', () => {
    expect(() => SocialLink.of(null)).toThrow(/social.id/)
    expect(() => SocialLink.of({ ...valid, label: '' })).toThrow(/social.label: es obligatorio/)
    expect(() => SocialLink.of({ ...valid, href: null })).toThrow(/social.href/)
  })

  it('exige que el id sea kebab-case', () => {
    expect(() => SocialLink.of({ ...valid, id: 'GitHub' })).toThrow(/kebab-case/)
  })

  it('usa el nombre de campo que se le pasa, para que el error ubique el problema', () => {
    expect(() => SocialLink.of({}, 'profile.socials[2]')).toThrow(/profile.socials\[2\].id/)
  })
})

describe('Stat', () => {
  const valid = { id: 'years-experience', value: 4, suffix: '+', labelKey: 'yearsExperience' }

  it('acepta un stat completo', () => {
    expect(Stat.of({ ...valid, position: 1 }).toJSON()).toEqual({
      id: 'years-experience',
      value: 4,
      suffix: '+',
      labelKey: 'yearsExperience',
      position: 1,
    })
  })

  it('sin position, asume la primera', () => {
    expect(Stat.of(valid).position).toBe(0)
  })

  it.each([
    ['ausente', undefined],
    ['nulo', null],
    ['un numero', 42],
  ])('trata un sufijo %s como vacio', (_label, suffix) => {
    // "4 empresas" no lleva sufijo, y eso es legitimo.
    expect(Stat.of({ ...valid, suffix }).suffix).toBe('')
  })

  it('recorta el sufijo', () => {
    expect(Stat.of({ ...valid, suffix: ' + ' }).suffix).toBe('+')
  })

  it('acepta cero pero no valores negativos', () => {
    expect(Stat.of({ ...valid, value: 0 }).value).toBe(0)
    expect(() => Stat.of({ ...valid, value: -1 })).toThrow(/stat.value/)
  })

  it('exige la clave de traduccion, no el texto ya traducido', () => {
    // El texto vive en los mensajes de UI del front, que es quien sabe decirlo
    // en dos idiomas. Guardarlo aqui duplicaria la traduccion.
    expect(() => Stat.of({ ...valid, labelKey: '' })).toThrow(/stat.labelKey: es obligatorio/)
  })

  it('exige un id kebab-case', () => {
    expect(() => Stat.of(null)).toThrow(/stat.id/)
  })
})
