import { InvalidContentError } from '@/domain/errors'
import {
  parseBoolean,
  parseList,
  parseNonNegativeInteger,
  parseOptionalText,
  parseText,
  parseTextList,
} from './primitives'

describe('parseText', () => {
  it('recorta el texto', () => {
    expect(parseText('  hola  ', 'campo')).toBe('hola')
  })

  it('rechaza lo que no es texto', () => {
    expect(() => parseText(42, 'campo')).toThrow(/campo: se esperaba texto/)
    expect(() => parseText(undefined, 'campo')).toThrow(/campo: se esperaba texto/)
  })

  it('rechaza el vacio y el que solo tiene espacios', () => {
    expect(() => parseText('', 'campo')).toThrow(/campo: es obligatorio/)
    expect(() => parseText('   ', 'campo')).toThrow(/campo: es obligatorio/)
  })

  it('respeta un maximo cuando se le da', () => {
    expect(parseText('abc', 'campo', 3)).toBe('abc')
    expect(() => parseText('abcd', 'campo', 3)).toThrow(/supera los 3 caracteres/)
  })
})

describe('parseOptionalText', () => {
  it.each([null, undefined, ''])('colapsa %s a null', (value) => {
    expect(parseOptionalText(value, 'campo')).toBeNull()
  })

  it('valida cuando hay algo', () => {
    expect(parseOptionalText(' hola ', 'campo')).toBe('hola')
    expect(() => parseOptionalText(42, 'campo')).toThrow(/se esperaba texto/)
  })
})

describe('parseTextList', () => {
  it('valida cada elemento y senala su indice', () => {
    expect(parseTextList([' a ', 'b'], 'tags')).toEqual(['a', 'b'])
    expect(() => parseTextList(['a', 42], 'tags')).toThrow(/tags\[1\]: se esperaba texto/)
  })

  it('rechaza lo que no es una lista', () => {
    expect(() => parseTextList('a,b', 'tags')).toThrow(/tags: se esperaba una lista/)
  })

  it('exige el minimo de elementos', () => {
    expect(() => parseTextList([], 'tags')).toThrow(/tags: necesita al menos 1/)
    expect(() => parseTextList(['a'], 'tags', 2)).toThrow(/tags: necesita al menos 2/)
  })
})

describe('parseList', () => {
  it('devuelve la lista sin tocar sus elementos', () => {
    const items = [{ a: 1 }, { b: 2 }]

    expect(parseList(items, 'items')).toBe(items)
  })

  it('rechaza lo que no es una lista y las listas cortas', () => {
    expect(() => parseList({}, 'items')).toThrow(/items: se esperaba una lista/)
    expect(() => parseList([], 'items')).toThrow(/items: necesita al menos 1/)
  })

  it('acepta una lista vacia si el minimo es cero', () => {
    expect(parseList([], 'items', 0)).toEqual([])
  })
})

describe('parseBoolean', () => {
  it('acepta solo booleanos de verdad', () => {
    expect(parseBoolean(true, 'available')).toBe(true)
    expect(parseBoolean(false, 'available')).toBe(false)
  })

  it.each(['true', 1, 0, null, undefined])('rechaza %s', (value) => {
    // Aceptar 'true' o 1 aqui parece amable, pero convierte un error del cliente
    // en un dato silenciosamente distinto al que quiso enviar.
    expect(() => parseBoolean(value, 'available')).toThrow(/available: se esperaba true o false/)
  })
})

describe('parseNonNegativeInteger', () => {
  it('acepta cero y positivos enteros', () => {
    expect(parseNonNegativeInteger(0, 'position')).toBe(0)
    expect(parseNonNegativeInteger(7, 'position')).toBe(7)
  })

  it.each([-1, 1.5, NaN, Infinity, '3', null])('rechaza %s', (value) => {
    expect(() => parseNonNegativeInteger(value, 'position')).toThrow(
      /position: se esperaba un entero no negativo/,
    )
  })

  it('rechaza InvalidContentError con el tipo correcto', () => {
    expect(() => parseNonNegativeInteger(-1, 'position')).toThrow(InvalidContentError)
  })
})
