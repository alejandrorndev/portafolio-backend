/*
 * Genera los secretos que el .env necesita.
 *
 * Existe para que nadie tenga que inventarse un JWT_SECRET a mano ni buscar como
 * hashear una contraseña: las dos cosas se hacen mal cuando hay prisa, y un
 * secreto debil o una contraseña en claro en el entorno sobreviven hasta
 * produccion.
 *
 *   pnpm secrets                  -> genera JWT_SECRET y una contraseña
 *   pnpm secrets "mi contrasena"  -> usa esa contraseña
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

const password = process.argv[2] ?? randomBytes(12).toString('base64url')
const hash = await bcrypt.hash(password, 12)

console.log('')
console.log('# Pegar en .env:')
console.log(`JWT_SECRET=${randomBytes(48).toString('base64url')}`)
console.log('ADMIN_EMAIL=admin@portafolio.local')
console.log(`ADMIN_PASSWORD_HASH=${hash}`)
console.log('')
console.log(`# La contrasena del administrador es:  ${password}`)
console.log('# No queda guardada en ningun sitio: apuntala ahora.')
console.log('')
