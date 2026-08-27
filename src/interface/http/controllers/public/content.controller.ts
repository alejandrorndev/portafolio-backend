import { Controller, Get, Header, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  GetExperienceUseCase,
  GetProfileUseCase,
  GetProjectUseCase,
  ListExperienceUseCase,
  ListProjectsUseCase,
  ListSkillCategoriesUseCase,
} from '@/application/content/use-cases'
import { DEFAULT_LOCALE, parseLocale, type Locale } from '@/domain/value-objects'
import { LocaleQueryDto } from '@/interface/http/dto'
import {
  ContentPresenter,
  type PublicExperienceItem,
  type PublicProfile,
  type PublicProject,
  type PublicSkillCategory,
} from '@/interface/http/presenters/content.presenter'

/*
 * -----------------------------------------------------------------------------
 * Lectura publica del portafolio.
 * -----------------------------------------------------------------------------
 * Sin autenticacion: es el contenido de un sitio publico, y pedir un token para
 * leer lo que cualquiera ve en la web no protegeria nada.
 *
 * `Cache-Control` de 60 segundos con `stale-while-revalidate`: contenido que
 * cambia dos veces al año no tiene por que golpear la base de datos en cada
 * visita. El `ETag` lo agrega Express solo, asi que un cliente que ya tiene la
 * respuesta recibe un 304 sin cuerpo.
 * -----------------------------------------------------------------------------
 */
const PUBLIC_CACHE = 'public, max-age=60, stale-while-revalidate=300'

/** `?locale` ausente cae al idioma por defecto; invalido es 400, no un fallback. */
const localeOf = (query: LocaleQueryDto): Locale =>
  query.locale === undefined ? DEFAULT_LOCALE : parseLocale(query.locale)

@ApiTags('contenido publico')
@Controller('profile')
export class PublicProfileController {
  constructor(private readonly getProfile: GetProfileUseCase) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Perfil, resuelto al idioma pedido' })
  @ApiOkResponse({ description: 'La misma forma que devuelve getProfile(locale) en el front' })
  async get(@Query() query: LocaleQueryDto): Promise<PublicProfile> {
    return ContentPresenter.profile(await this.getProfile.execute(), localeOf(query))
  }
}

@ApiTags('contenido publico')
@Controller('projects')
export class PublicProjectsController {
  constructor(
    private readonly listProjects: ListProjectsUseCase,
    private readonly getProject: GetProjectUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({ summary: 'Proyectos, ordenados y resueltos al idioma pedido' })
  async list(@Query() query: LocaleQueryDto): Promise<PublicProject[]> {
    const locale = localeOf(query)
    const projects = await this.listProjects.execute()

    return projects.map((project) => ContentPresenter.project(project, locale))
  }

  @Get(':id')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiParam({ name: 'id', example: 'api-rest-eventos' })
  @ApiOperation({ summary: 'Un proyecto por su id' })
  async get(@Param('id') id: string, @Query() query: LocaleQueryDto): Promise<PublicProject> {
    return ContentPresenter.project(await this.getProject.execute(id), localeOf(query))
  }
}

@ApiTags('contenido publico')
@Controller('experience')
export class PublicExperienceController {
  constructor(
    private readonly listExperience: ListExperienceUseCase,
    private readonly getExperience: GetExperienceUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'Experiencia, ordenada y resuelta al idioma pedido',
    description: '`isCurrent` viene derivado de que el periodo no tenga fin.',
  })
  async list(@Query() query: LocaleQueryDto): Promise<PublicExperienceItem[]> {
    const locale = localeOf(query)
    const items = await this.listExperience.execute()

    return items.map((item) => ContentPresenter.experienceItem(item, locale))
  }

  @Get(':id')
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiParam({ name: 'id', example: 'homepower' })
  @ApiOperation({ summary: 'Una experiencia por su id' })
  async get(
    @Param('id') id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<PublicExperienceItem> {
    return ContentPresenter.experienceItem(await this.getExperience.execute(id), localeOf(query))
  }
}

@ApiTags('contenido publico')
@Controller('skills')
export class PublicSkillsController {
  constructor(private readonly listSkills: ListSkillCategoriesUseCase) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE)
  @ApiOperation({
    summary: 'Categorias de skills con sus items, ordenadas',
    description: 'Los items publicos llevan solo `name` e `icon`, como espera el front.',
  })
  async list(@Query() query: LocaleQueryDto): Promise<PublicSkillCategory[]> {
    const locale = localeOf(query)
    const categories = await this.listSkills.execute()

    return categories.map((category) => ContentPresenter.skillCategory(category, locale))
  }
}
