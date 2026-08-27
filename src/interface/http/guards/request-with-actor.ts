import type { Actor } from '@/domain/entities'

/** Clave bajo la que el guard deja el actor en la peticion. */
export const ACTOR_REQUEST_KEY = 'actor' as const

/**
 * La peticion HTTP con el actor ya resuelto.
 *
 * Se declara el tipo en vez de usar `any`: es lo unico que evita que un cambio en
 * la clave o en la forma del actor se descubra en runtime.
 */
export interface RequestWithActor {
  headers: Record<string, string | string[] | undefined>
  [ACTOR_REQUEST_KEY]?: Actor
}
