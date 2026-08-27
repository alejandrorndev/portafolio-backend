import { JwtService } from '@nestjs/jwt'
import { UnauthorizedError } from '@/domain/errors'
import { BcryptHasher } from './bcrypt-hasher.service'
import { JwtTokenService } from './jwt-token.service'
import { isKnownRole } from './known-role.util'

/*
 * bcrypt con coste 12 es lento a proposito, y en JavaScript puro mas: cada hash
 * ronda el segundo. Estos tests no mockean la libreria —seria probar el mock— asi
 * que pagan ese tiempo y necesitan mas margen que el de cinco segundos.
 */
jest.setTimeout(60_000)

describe('BcryptHasher', () => {
  const hasher = new BcryptHasher()

  it('el hash no se parece a la contraseña', async () => {
    const hash = await hasher.hash('mi-contrasena')

    expect(hash).not.toContain('mi-contrasena')
    expect(hash.startsWith('$2')).toBe(true)
  })

  it('hashear la misma contraseña dos veces da resultados distintos', async () => {
    // Es la sal: sin ella, dos usuarios con la misma contraseña tendrian el mismo
    // hash, y una tabla precalculada los rompe a los dos de una vez.
    const [a, b] = await Promise.all([hasher.hash('igual'), hasher.hash('igual')])

    expect(a).not.toBe(b)
  })

  it('usa coste 12', async () => {
    expect(await hasher.hash('x')).toContain('$12$')
  })

  it('reconoce la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hasher.hash('correcta')

    expect(await hasher.compare('correcta', hash)).toBe(true)
    expect(await hasher.compare('incorrecta', hash)).toBe(false)
  })

  it('un hash corrupto es "no entra", no un error', async () => {
    // Para quien llama, un hash mal formado y una contraseña equivocada son lo
    // mismo; propagar la excepcion convertiria un dato malo en un 500.
    expect(await hasher.compare('cualquiera', 'esto-no-es-un-hash')).toBe(false)
    expect(await hasher.compare('cualquiera', '')).toBe(false)
    expect(await hasher.compare('cualquiera', '$2z$12$revisioninventada')).toBe(false)
  })

  it('una columna nula tampoco revienta', async () => {
    // bcryptjs SI lanza cuando el hash no es texto. Es el unico camino al catch, y
    // llega si una fila queda con password_hash en NULL.
    expect(await hasher.compare('cualquiera', null as unknown as string)).toBe(false)
  })
})

describe('JwtTokenService', () => {
  const secret = 'un-secreto-de-mas-de-32-caracteres-para-la-prueba'
  const service = (options: { secret?: string; expiresIn?: number } = {}) =>
    new JwtTokenService(
      new JwtService({ secret: options.secret ?? secret }),
      options.expiresIn ?? 28_800,
    )

  const payload = { sub: 'user-1', email: 'admin@correo.co', role: 'admin' as const }

  it('firma y vuelve a leer el payload', async () => {
    const tokens = service()
    const { accessToken, expiresIn } = await tokens.sign(payload)

    expect(expiresIn).toBe(28_800)
    await expect(tokens.verify(accessToken)).resolves.toEqual(payload)
  })

  it('el token no lleva nada mas que sub, email y rol', async () => {
    const tokens = service()
    const { accessToken } = await tokens.sign(payload)
    const claims = JSON.parse(
      Buffer.from(accessToken.split('.')[1] as string, 'base64url').toString('utf8'),
    ) as Record<string, unknown>

    // iat y exp los agrega el estandar; lo que no puede aparecer es un hash ni el
    // estado de la cuenta.
    expect(Object.keys(claims).sort()).toEqual(['email', 'exp', 'iat', 'role', 'sub'])
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const { accessToken } = await service({
      secret: 'otro-secreto-igual-de-largo-para-firmar',
    }).sign(payload)

    await expect(service().verify(accessToken)).rejects.toThrow(UnauthorizedError)
  })

  it('rechaza un token expirado', async () => {
    const { accessToken } = await service({ expiresIn: -1 }).sign(payload)

    await expect(service().verify(accessToken)).rejects.toThrow(UnauthorizedError)
  })

  it('rechaza un token que no es un token', async () => {
    await expect(service().verify('esto.no.es')).rejects.toThrow(UnauthorizedError)
    await expect(service().verify('')).rejects.toThrow(UnauthorizedError)
  })

  it('rechaza un token bien firmado pero con el payload incompleto', async () => {
    const jwt = new JwtService({ secret })
    const token = await jwt.signAsync({ sub: 'user-1' })

    await expect(service().verify(token)).rejects.toThrow(UnauthorizedError)
  })

  it('rechaza un token bien firmado con un rol desconocido', async () => {
    // Un rol que se elimino del sistema no puede colarse como permisos
    // indefinidos.
    const jwt = new JwtService({ secret })
    const token = await jwt.signAsync({ ...payload, role: 'superadmin' })

    await expect(service().verify(token)).rejects.toThrow(UnauthorizedError)
  })

  it('todos los fallos dan el MISMO error, sin decir cual fue', async () => {
    const messages = await Promise.all(
      [
        'esto.no.es',
        await service({ expiresIn: -1 })
          .sign(payload)
          .then((t) => t.accessToken),
      ].map((token) =>
        service()
          .verify(token)
          .catch((error: Error) => error.message),
      ),
    )

    expect(new Set(messages).size).toBe(1)
  })
})

describe('isKnownRole', () => {
  it.each(['admin', 'editor'])('acepta %s', (role) => {
    expect(isKnownRole(role)).toBe(true)
  })

  it.each(['superadmin', 'ADMIN', '', null, 42, undefined])('rechaza %s', (role) => {
    expect(isKnownRole(role)).toBe(false)
  })
})
