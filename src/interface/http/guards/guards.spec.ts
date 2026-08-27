import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticateTokenUseCase } from '@/application/auth/use-cases'
import { Actor } from '@/domain/entities'
import { ForbiddenActionError, UnauthorizedError } from '@/domain/errors'
import type { RoleName } from '@/domain/value-objects/role'
import { currentActorFactory } from './current-actor.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'
import { ACTOR_REQUEST_KEY, type RequestWithActor } from './request-with-actor'
import { Roles, ROLES_METADATA } from './roles.decorator'
import { RolesGuard } from './roles.guard'

const actorOf = (role: RoleName): Actor =>
  Actor.of({ id: 'user-1', email: 'alguien@correo.co', role })

/** Un ExecutionContext con lo justo que los guards consultan. */
const contextWith = (request: RequestWithActor): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  }) as unknown as ExecutionContext

describe('JwtAuthGuard', () => {
  const authenticateReturning = (actor: Actor): AuthenticateTokenUseCase =>
    ({ execute: jest.fn().mockResolvedValue(actor) }) as unknown as AuthenticateTokenUseCase

  it('deja pasar con un token valido y guarda el actor en la peticion', async () => {
    const request: RequestWithActor = { headers: { authorization: 'Bearer un.token.valido' } }
    const actor = actorOf('admin')

    await expect(
      new JwtAuthGuard(authenticateReturning(actor)).canActivate(contextWith(request)),
    ).resolves.toBe(true)
    expect(request[ACTOR_REQUEST_KEY]).toBe(actor)
  })

  it('pasa al caso de uso solo el token, sin el prefijo Bearer', async () => {
    const authenticate = authenticateReturning(actorOf('admin'))

    await new JwtAuthGuard(authenticate).canActivate(
      contextWith({ headers: { authorization: 'Bearer   un.token.valido  ' } }),
    )

    expect(authenticate.execute).toHaveBeenCalledWith('un.token.valido')
  })

  it.each([
    ['sin cabecera', {}],
    ['con un esquema que no es Bearer', { authorization: 'Basic dXNlcjpwYXNz' }],
    ['con Bearer vacio', { authorization: 'Bearer ' }],
    ['con la cabecera repetida (array)', { authorization: ['Bearer a', 'Bearer b'] }],
  ])('rechaza una peticion %s', async (_label, headers) => {
    const guard = new JwtAuthGuard(authenticateReturning(actorOf('admin')))

    await expect(guard.canActivate(contextWith({ headers }))).rejects.toThrow(UnauthorizedError)
  })

  it('propaga el error del dominio cuando el token no verifica', async () => {
    const failing = {
      execute: jest.fn().mockRejectedValue(new UnauthorizedError()),
    } as unknown as AuthenticateTokenUseCase

    await expect(
      new JwtAuthGuard(failing).canActivate(
        contextWith({ headers: { authorization: 'Bearer x' } }),
      ),
    ).rejects.toThrow(UnauthorizedError)
  })
})

describe('RolesGuard', () => {
  const guardWith = (allowed: RoleName[] | undefined): RolesGuard => {
    const reflector = new Reflector()
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowed)

    return new RolesGuard(reflector)
  }

  const requestOf = (role: RoleName): RequestWithActor => ({
    headers: {},
    [ACTOR_REQUEST_KEY]: actorOf(role),
  })

  it('deja pasar cuando el rol esta en la lista', () => {
    expect(guardWith(['admin']).canActivate(contextWith(requestOf('admin')))).toBe(true)
  })

  it('deja pasar a un editor en una ruta que admite los dos roles', () => {
    expect(guardWith(['admin', 'editor']).canActivate(contextWith(requestOf('editor')))).toBe(true)
  })

  it('rechaza a un editor en una ruta solo de admin', () => {
    expect(() => guardWith(['admin']).canActivate(contextWith(requestOf('editor')))).toThrow(
      ForbiddenActionError,
    )
  })

  it('el mensaje dice con que rol se intento', () => {
    expect(() => guardWith(['admin']).canActivate(contextWith(requestOf('editor')))).toThrow(
      /rol "editor"/,
    )
  })

  describe('falla cerrado', () => {
    it('DENIEGA cuando la ruta no declara @Roles', () => {
      // Es la decision mas importante del guard: un guard que permite por
      // omision convierte un olvido en un endpoint abierto. Asi, el olvido es un
      // 403 que aparece en el primer intento.
      expect(() => guardWith(undefined).canActivate(contextWith(requestOf('admin')))).toThrow(
        ForbiddenActionError,
      )
    })

    it('el mensaje explica que falta el decorador', () => {
      expect(() => guardWith(undefined).canActivate(contextWith(requestOf('admin')))).toThrow(
        /falta @Roles/,
      )
    })

    it('DENIEGA tambien con una lista de roles vacia', () => {
      expect(() => guardWith([]).canActivate(contextWith(requestOf('admin')))).toThrow(
        ForbiddenActionError,
      )
    })

    it('responde 401 si no hay actor: JwtAuthGuard no corrio antes', () => {
      // Es un error de configuracion del modulo. Asumir un rol seria peor.
      expect(() => guardWith(['admin']).canActivate(contextWith({ headers: {} }))).toThrow(
        UnauthorizedError,
      )
    })
  })
})

describe('@Roles', () => {
  it('deja los roles permitidos como metadata de la ruta', () => {
    class Controller {
      @Roles('admin')
      soloAdmin(): void {}

      @Roles('admin', 'editor')
      losDos(): void {}
    }

    const target = Controller.prototype

    expect(Reflect.getMetadata(ROLES_METADATA, target.soloAdmin)).toEqual(['admin'])
    expect(Reflect.getMetadata(ROLES_METADATA, target.losDos)).toEqual(['admin', 'editor'])
  })

  it('un metodo sin el decorador no tiene metadata, y por eso el guard deniega', () => {
    class Controller {
      sinDecorador(): void {}
    }

    expect(Reflect.getMetadata(ROLES_METADATA, Controller.prototype.sinDecorador)).toBeUndefined()
  })
})

describe('currentActorFactory', () => {
  it('devuelve el actor que dejo el guard en la peticion', () => {
    const actor = actorOf('editor')

    expect(
      currentActorFactory(undefined, contextWith({ headers: {}, [ACTOR_REQUEST_KEY]: actor })),
    ).toBe(actor)
  })

  it('devuelve undefined en una ruta sin guard, para que el fallo salga de inmediato', () => {
    expect(currentActorFactory(undefined, contextWith({ headers: {} }))).toBeUndefined()
  })
})
