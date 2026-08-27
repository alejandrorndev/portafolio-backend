import { Inject, Injectable } from '@nestjs/common'
import { Profile, type ProfileInput } from '@/domain/entities'
import { NotFoundError } from '@/domain/errors'
import { PROFILE_REPOSITORY, type IProfileRepository } from '@/domain/ports'

/*
 * El perfil no tiene lista, ni creacion, ni borrado.
 *
 * No es una omision: hay exactamente un perfil, lo crea el seed, y borrarlo
 * dejaria el portafolio sin nombre, sin correo y sin secciones. Ninguna operacion
 * del negocio lo pide, asi que no existe el caso de uso que lo permita.
 */

@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly repository: IProfileRepository) {}

  async execute(): Promise<Profile> {
    const profile = await this.repository.get()

    // Que no exista es un estado real —base recien migrada, seed sin correr— y
    // decirlo con un 404 es mas util que devolver un perfil vacio que el front
    // pintaria como una pagina en blanco.
    if (profile === null) throw new NotFoundError('profile', 'singleton')

    return profile
  }
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly repository: IProfileRepository) {}

  async execute(changes: Partial<ProfileInput>): Promise<Profile> {
    const current = await this.repository.get()

    if (current === null) throw new NotFoundError('profile', 'singleton')

    const updated = current.patch(changes)

    await this.repository.save(updated)

    return updated
  }
}

@Injectable()
export class CreateProfileUseCase {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly repository: IProfileRepository) {}

  /**
   * Solo para el seed inicial.
   *
   * Si ya existe un perfil, no lo pisa: el seed es idempotente y correrlo dos
   * veces no puede deshacer ediciones hechas desde el panel.
   */
  async execute(input: ProfileInput): Promise<Profile> {
    const existing = await this.repository.get()

    if (existing !== null) return existing

    const profile = Profile.create(input)

    await this.repository.save(profile)

    return profile
  }
}
