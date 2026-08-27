import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import type { IHasher } from '@/domain/ports'

/**
 * Hasheo con bcrypt.
 *
 * Se usa `bcryptjs` (JavaScript puro) y no `bcrypt` (binding nativo): evita
 * node-gyp en Windows y en la imagen Alpine del deploy, a cambio de unos
 * milisegundos por operacion. Para un login por jornada de trabajo, esos
 * milisegundos no existen.
 *
 * El coste 12 no es arbitrario: es lento a proposito. Cada incremento duplica el
 * trabajo de comprobar una contraseña, y eso es lo que hace inviable probar
 * millones si algun dia se filtra la tabla.
 */
const COST = 12

@Injectable()
export class BcryptHasher implements IHasher {
  async hash(plain: string): Promise<string> {
    return hash(plain, COST)
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    /*
     * bcryptjs lanza si el hash esta mal formado. Para quien llama, un hash
     * corrupto y una contraseña incorrecta son lo mismo —no entra— y propagar la
     * excepcion convertiria un dato malo en un 500.
     */
    try {
      return await compare(plain, hashed)
    } catch {
      return false
    }
  }
}
