import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator'
import { ACCENTS } from '@/domain/value-objects/accent'
import { LOCALES } from '@/domain/value-objects/locale'

/*
 * -----------------------------------------------------------------------------
 * DTOs: la primera barrera, no la autoritativa.
 * -----------------------------------------------------------------------------
 * Estas reglas repiten las de los value objects del dominio, y la duplicacion es
 * deliberada (§3.4 del diseño). El DTO existe para experiencia de uso: falla
 * rapido, con un 400 que dice exactamente que campo esta mal y por que. El
 * dominio es el que manda, porque tambien se invoca desde el seed y desde tests,
 * donde no hay ningun DTO de por medio.
 *
 * Con `forbidNonWhitelisted` en el ValidationPipe, un campo que no este declarado
 * aqui es un 400. Es a proposito: un campo mal escrito que se ignora en silencio
 * es un cambio que el editor cree haber guardado y no se guardo.
 * -----------------------------------------------------------------------------
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX = /^#[0-9a-fA-F]{6}$/

/** Texto en todos los idiomas del sitio. */
export class LocalizedTextDto {
  @ApiProperty({ example: 'Texto en español' })
  @IsString()
  @IsNotEmpty()
  es!: string

  @ApiProperty({ example: 'Text in English' })
  @IsString()
  @IsNotEmpty()
  en!: string
}

/** `?locale=es` de los endpoints publicos. */
export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: LOCALES, default: 'es' })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: string
}

/** Cuerpo de los endpoints de reordenamiento. */
export class ReorderDto {
  @ApiProperty({
    type: [String],
    description: 'Todos los ids existentes, en el orden deseado.',
    example: ['api-rest-eventos', 'carrito-compras-react'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[]
}

export class ProjectLinksDto {
  @ApiPropertyOptional({ example: 'https://demo.midominio.com' })
  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//, { message: 'demo debe usar https' })
  demo?: string

  @ApiPropertyOptional({ example: 'https://github.com/usuario/repo' })
  @IsOptional()
  @IsString()
  @Matches(/^https:\/\//, { message: 'github debe usar https' })
  github?: string
}

export class CreateProjectDto {
  @ApiProperty({ example: 'api-rest-eventos', description: 'kebab-case; es el ancla de URL' })
  @Matches(SLUG, { message: 'id debe ser kebab-case en minusculas' })
  id!: string

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  type!: LocalizedTextDto

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description!: LocalizedTextDto

  @ApiProperty({ type: [String], example: ['NestJS', 'PostgreSQL'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tags!: string[]

  @ApiProperty({ example: '🎟️', description: 'Emoji que representa al proyecto' })
  @IsString()
  @IsNotEmpty()
  icon!: string

  @ApiProperty({
    type: [String],
    description: 'Gradiente del preview: [desde, hasta] en hexadecimal de 6 digitos',
    example: ['#7c3aed', '#06b6d4'],
  })
  @IsArray()
  @ArrayMinSize(2)
  @Matches(HEX, { each: true, message: 'gradient debe llevar hexadecimales de 6 digitos' })
  gradient!: string[]

  @ApiProperty({
    type: ProjectLinksDto,
    description: 'Al menos uno de los dos: una tarjeta sin enlaces no le sirve a nadie',
  })
  @ValidateNested()
  @Type(() => ProjectLinksDto)
  links!: ProjectLinksDto
}

/*
 * `PartialType` hace opcionales todos los campos y conserva las validaciones.
 * `id` no se puede cambiar —el caso de uso lo descarta— pero se acepta en el
 * cuerpo para que enviar el objeto completo de vuelta no sea un 400.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class PeriodDto {
  @ApiProperty({ example: '2024', description: 'Etiqueta, no fecha: se muestra tal cual' })
  @IsString()
  @IsNotEmpty()
  start!: string

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'null significa "en curso"',
  })
  @IsOptional()
  @IsString()
  end?: string | null
}

export class CreateExperienceDto {
  @ApiProperty({ example: 'homepower' })
  @Matches(SLUG, { message: 'id debe ser kebab-case en minusculas' })
  id!: string

  @ApiProperty({ type: PeriodDto })
  @ValidateNested()
  @Type(() => PeriodDto)
  period!: PeriodDto

  @ApiProperty({ example: 'Homepower Colombia' })
  @IsString()
  @IsNotEmpty()
  company!: string

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  role!: LocalizedTextDto

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description!: LocalizedTextDto

  @ApiProperty({ type: [String], example: ['NestJS', 'AWS'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  stack!: string[]

  @ApiProperty({ enum: ACCENTS })
  @IsIn(ACCENTS)
  accent!: string
}

export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}

export class SkillItemDto {
  @ApiProperty({ example: 'NestJS' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({
    example: 'nestjs-plain',
    description: 'Nombre de un icono vendorizado por el front; la base de datos lo verifica',
  })
  @IsString()
  @IsNotEmpty()
  icon!: string
}

export class CreateSkillCategoryDto {
  @ApiProperty({ example: 'backend' })
  @Matches(SLUG, { message: 'id debe ser kebab-case en minusculas' })
  id!: string

  @ApiProperty({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title!: LocalizedTextDto

  @ApiProperty({ enum: ACCENTS })
  @IsIn(ACCENTS)
  accent!: string

  @ApiProperty({ type: [SkillItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items!: SkillItemDto[]
}

/**
 * Los campos que una categoria puede cambiar.
 *
 * Los items NO estan aqui a proposito: agregar, quitar y reordenar skills tienen
 * sus propias rutas, porque cada una tiene reglas distintas (una categoria no
 * puede quedarse vacia, las posiciones se recompactan). Permitir reemplazar la
 * lista entera en un PUT se saltaria todas.
 */
class SkillCategoryUpdatableFields {
  @ApiPropertyOptional({ type: LocalizedTextDto })
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto

  @ApiPropertyOptional({ enum: ACCENTS })
  @IsIn(ACCENTS)
  accent?: string
}

export class UpdateSkillCategoryDto extends PartialType(SkillCategoryUpdatableFields) {}

export class SocialLinkDto {
  @ApiProperty({ example: 'github' })
  @Matches(SLUG, { message: 'id debe ser kebab-case en minusculas' })
  id!: string

  @ApiProperty({ example: 'GitHub' })
  @IsString()
  @IsNotEmpty()
  label!: string

  @ApiProperty({
    example: 'https://github.com/usuario',
    description: 'Admite mailto: — el perfil incluye el correo directo',
  })
  @IsString()
  @IsNotEmpty()
  href!: string

  @ApiPropertyOptional({ example: 'github-original', nullable: true })
  @IsOptional()
  @IsString()
  icon?: string | null
}

export class StatDto {
  @ApiProperty({ example: 'years-experience' })
  @Matches(SLUG, { message: 'id debe ser kebab-case en minusculas' })
  id!: string

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(0)
  value!: number

  @ApiProperty({ example: '+', description: 'Puede ir vacio: "4 empresas" no lleva sufijo' })
  @IsString()
  suffix!: string

  @ApiProperty({
    example: 'yearsExperience',
    description: 'CLAVE de traduccion; el texto vive en los mensajes de UI del front',
  })
  @IsString()
  @IsNotEmpty()
  labelKey!: string
}

export class DisplayNameDto {
  @ApiProperty({ example: 'Alejandro' })
  @IsString()
  @IsNotEmpty()
  first!: string

  @ApiProperty({ example: 'Restrepo' })
  @IsString()
  @IsNotEmpty()
  last!: string
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alejandro Stiven Restrepo Naranjo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string

  @ApiPropertyOptional({ type: DisplayNameDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayNameDto)
  displayName?: DisplayNameDto

  @ApiPropertyOptional({ example: 'AR.dev' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  brand?: string

  @ApiPropertyOptional({ example: 'correo@dominio.com' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  location?: LocalizedTextDto

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  available?: boolean

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  headline?: LocalizedTextDto

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  role?: LocalizedTextDto

  @ApiPropertyOptional({ type: LocalizedTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  summary?: LocalizedTextDto

  @ApiPropertyOptional({ type: [LocalizedTextDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LocalizedTextDto)
  bio?: LocalizedTextDto[]

  @ApiPropertyOptional({ type: [LocalizedTextDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LocalizedTextDto)
  typewriterRoles?: LocalizedTextDto[]

  @ApiPropertyOptional({ type: [SocialLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socials?: SocialLinkDto[]

  @ApiPropertyOptional({ type: [StatDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StatDto)
  stats?: StatDto[]

  @ApiPropertyOptional({
    type: LocalizedTextDto,
    nullable: true,
    description: 'Rutas al PDF bajo public/. null quita el boton de descarga',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  cv?: LocalizedTextDto | null
}
