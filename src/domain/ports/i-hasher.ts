/**
 * Hasheo de contraseñas.
 *
 * El dominio no sabe que hay bcrypt detras, y eso no es purismo: el coste del
 * hash y el algoritmo son decisiones de infraestructura que cambian con el
 * hardware, mientras que "la contraseña no se guarda en claro" es una regla que
 * no cambia nunca.
 */
export interface IHasher {
  hash(plain: string): Promise<string>
  compare(plain: string, hash: string): Promise<boolean>
}

export const HASHER = 'IHasher'
