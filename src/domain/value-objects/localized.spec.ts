import { InvalidContentError } from '@/domain/errors'
import { Localized } from './localized'

describe('Localized', () => {
  describe('of', () => {
    it('construye cuando estan todos los idiomas', () => {
      const localized = Localized.of<string>({ es: 'hola', en: 'hi' })

      expect(localized.get('es')).toBe('hola')
      expect(localized.get('en')).toBe('hi')
    })

    it('rechaza un idioma faltante, que es el error mas probable del sitio', () => {
      expect(() => Localized.of({ es: 'hola' }, 'title')).toThrow(InvalidContentError)
      expect(() => Localized.of({ es: 'hola' }, 'title')).toThrow(/title: falta el idioma "en"/)
    })

    it('trata null como ausencia', () => {
      expect(() => Localized.of({ es: 'hola', en: null })).toThrow(/falta el idioma "en"/)
    })

    it('acepta valores que no son texto', () => {
      // `Localized` es generico a proposito: el CV es una ruta, pero mañana
      // podria ser un objeto con mas de un campo por idioma.
      const localized = Localized.of<number>({ es: 1, en: 2 })

      expect(localized.get('en')).toBe(2)
    })

    it('ignora idiomas desconocidos en vez de guardarlos', () => {
      const localized = Localized.of<string>({ es: 'hola', en: 'hi', fr: 'salut' })

      expect(localized.toJSON()).toEqual({ es: 'hola', en: 'hi' })
    })

    it.each([
      ['un string', 'hola'],
      ['un numero', 42],
      ['null', null],
      ['un array', ['es', 'en']],
    ])('rechaza %s en lugar de un objeto por idioma', (_label, input) => {
      expect(() => Localized.of(input, 'summary')).toThrow(/summary: se esperaba un objeto/)
    })
  })

  describe('text', () => {
    it('recorta los espacios de cada idioma', () => {
      const localized = Localized.text({ es: '  hola  ', en: '\thi\n' })

      expect(localized.toJSON()).toEqual({ es: 'hola', en: 'hi' })
    })

    it('rechaza un idioma vacio o con solo espacios', () => {
      // Pasaria la comprobacion de presencia y produciria una tarjeta con el
      // titulo en blanco, que es peor que fallar al guardar.
      expect(() => Localized.text({ es: 'hola', en: '   ' }, 'title')).toThrow(
        /title: el idioma "en" esta vacio/,
      )
    })

    it('rechaza un idioma que no es texto', () => {
      expect(() => Localized.text({ es: 'hola', en: 42 }, 'title')).toThrow(
        /title: el idioma "en" no es texto/,
      )
    })

    it('sigue exigiendo todos los idiomas', () => {
      expect(() => Localized.text({ es: 'hola' })).toThrow(/falta el idioma "en"/)
    })
  })

  describe('igualdad y serializacion', () => {
    it('dos valores con el mismo contenido son iguales', () => {
      expect(
        Localized.text({ es: 'a', en: 'b' }).equals(Localized.text({ es: 'a', en: 'b' })),
      ).toBe(true)
    })

    it('un idioma distinto los hace diferentes', () => {
      expect(
        Localized.text({ es: 'a', en: 'b' }).equals(Localized.text({ es: 'a', en: 'c' })),
      ).toBe(false)
    })

    it('toJSON devuelve una copia, no la referencia interna', () => {
      const localized = Localized.text({ es: 'a', en: 'b' })
      const json = localized.toJSON()

      json.es = 'modificado'

      expect(localized.get('es')).toBe('a')
    })
  })
})
