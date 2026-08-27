import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Actor } from '@/domain/entities'
import { ACTOR_REQUEST_KEY, type RequestWithActor } from './request-with-actor'

/**
 * La funcion que extrae el actor de la peticion.
 *
 * Se exporta aparte del decorador porque un `createParamDecorator` no se puede
 * invocar en un test sin montar medio framework, y lo que hay que probar es esto:
 * que lee la clave correcta.
 */
export const currentActorFactory = (_data: unknown, context: ExecutionContext): Actor => {
  const request = context.switchToHttp().getRequest<RequestWithActor>()

  /*
   * El `as Actor` es seguro porque este decorador solo se usa en rutas que pasan
   * por `JwtAuthGuard`. Si alguien lo pone en una ruta publica, el controller
   * recibe `undefined` y falla en el primer intento —en desarrollo— en vez de
   * autorizar a un actor inexistente.
   */
  return request[ACTOR_REQUEST_KEY] as Actor
}

/** Inyecta el actor autenticado en un parametro del controller. */
export const CurrentActor = createParamDecorator(currentActorFactory)
