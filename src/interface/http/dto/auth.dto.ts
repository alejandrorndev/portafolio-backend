import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'
import { ROLES } from '@/domain/value-objects/role'

/*
 * La longitud minima de contraseña se declara aqui y no en el dominio: es una
 * politica de la interfaz publica, no una regla del negocio. El dominio solo
 * exige que el HASH no llegue vacio, porque a esa altura la contraseña ya no
 * existe.
 */
const MIN_PASSWORD = 12

export class LoginDto {
  @ApiProperty({ example: 'admin@portafolio.local' })
  @IsString()
  @IsNotEmpty()
  email!: string

  @ApiProperty({ example: 'la-contrasena-del-admin' })
  @IsString()
  @IsNotEmpty()
  password!: string
}

export class CreateUserDto {
  @ApiProperty({ example: 'editor@portafolio.local' })
  @IsString()
  @IsNotEmpty()
  email!: string

  @ApiProperty({
    minLength: MIN_PASSWORD,
    description: `Minimo ${MIN_PASSWORD} caracteres. No se guarda: se guarda su hash`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD)
  password!: string

  @ApiProperty({ enum: ROLES, description: 'El editor escribe contenido; el admin ademas borra' })
  @IsIn(ROLES)
  role!: string
}

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Desactivar en lugar de borrar preserva la trazabilidad',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: MIN_PASSWORD })
  @IsString()
  @MinLength(MIN_PASSWORD)
  password!: string
}
