import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  AddSkillItemUseCase,
  CreateExperienceUseCase,
  CreateProjectUseCase,
  CreateSkillCategoryUseCase,
  DeleteExperienceUseCase,
  DeleteProjectUseCase,
  DeleteSkillCategoryUseCase,
  GetExperienceUseCase,
  GetProfileUseCase,
  GetProjectUseCase,
  GetSkillCategoryUseCase,
  ListExperienceUseCase,
  ListProjectsUseCase,
  ListSkillCategoriesUseCase,
  RemoveSkillItemUseCase,
  ReorderExperienceUseCase,
  ReorderProjectsUseCase,
  ReorderSkillCategoriesUseCase,
  ReorderSkillItemsUseCase,
  UpdateExperienceUseCase,
  UpdateProfileUseCase,
  UpdateProjectUseCase,
  UpdateSkillCategoryUseCase,
} from '@/application/content/use-cases'
import type { Actor } from '@/domain/entities'
import {
  CreateExperienceDto,
  CreateProjectDto,
  CreateSkillCategoryDto,
  ReorderDto,
  SkillItemDto,
  UpdateExperienceDto,
  UpdateProfileDto,
  UpdateProjectDto,
  UpdateSkillCategoryDto,
} from '@/interface/http/dto'
import { CurrentActor, JwtAuthGuard, Roles, RolesGuard } from '@/interface/http/guards'
import { AdminPresenter } from '@/interface/http/presenters/content.presenter'

/*
 * -----------------------------------------------------------------------------
 * Administracion del contenido.
 * -----------------------------------------------------------------------------
 * Devuelve el objeto BILINGUE completo, no el resuelto a un idioma: quien edita
 * necesita ver los dos.
 *
 * Dos cosas que hay que respetar al tocar estos archivos:
 *
 *   1. `@Roles(...)` es OBLIGATORIO en cada ruta. `RolesGuard` deniega si falta,
 *      asi que olvidarlo es un 403, no un endpoint abierto.
 *
 *   2. Las rutas ESTATICAS van antes que las paramétricas. `@Patch('reorder')`
 *      declarado despues de `@Patch(':id')` no se alcanza nunca: Nest resuelve en
 *      orden de declaracion y trataria "reorder" como el id de un proyecto. Es la
 *      misma trampa que documenta la skill `nestjs-route-apigw-safe`.
 * -----------------------------------------------------------------------------
 */

@ApiTags('admin · proyectos')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/projects')
export class AdminProjectsController {
  constructor(
    private readonly list: ListProjectsUseCase,
    private readonly get: GetProjectUseCase,
    private readonly create: CreateProjectUseCase,
    private readonly update: UpdateProjectUseCase,
    private readonly remove: DeleteProjectUseCase,
    private readonly reorder: ReorderProjectsUseCase,
  ) {}

  @Get()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Proyectos en su forma bilingue' })
  async listAll() {
    return (await this.list.execute()).map(AdminPresenter.project)
  }

  @Post()
  @Roles('admin', 'editor')
  @ApiOperation({
    summary: 'Crea un proyecto al final de la lista',
    description: 'La posicion no se recibe: se asigna al final. Mover es trabajo de reorder.',
  })
  async createOne(@Body() body: CreateProjectDto) {
    return AdminPresenter.project(await this.create.execute(body))
  }

  // Antes de ':id', o Nest tratara "reorder" como un id.
  @Patch('reorder')
  @Roles('admin', 'editor')
  @ApiOperation({
    summary: 'Reordena todos los proyectos',
    description: 'Exige la lista COMPLETA de ids en el orden deseado.',
  })
  async reorderAll(@Body() body: ReorderDto) {
    return (await this.reorder.execute(body.ids)).map(AdminPresenter.project)
  }

  @Get(':id')
  @Roles('admin', 'editor')
  @ApiParam({ name: 'id', example: 'api-rest-eventos' })
  async getOne(@Param('id') id: string) {
    return AdminPresenter.project(await this.get.execute(id))
  }

  @Put(':id')
  @Roles('admin', 'editor')
  @ApiParam({ name: 'id', example: 'api-rest-eventos' })
  @ApiOperation({
    summary: 'Edita un proyecto',
    description: '`id` y `position` se ignoran si vienen en el cuerpo.',
  })
  async updateOne(@Param('id') id: string, @Body() body: UpdateProjectDto) {
    return AdminPresenter.project(await this.update.execute(id, body))
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', example: 'api-rest-eventos' })
  @ApiOperation({
    summary: 'Borra un proyecto — solo admin',
    description:
      'Borrar destruye contenido bilingue sin historial que lo recupere, y por eso ' +
      'es la unica operacion que un editor no puede hacer.',
  })
  async deleteOne(@Param('id') id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.remove.execute(id, actor)
  }
}

@ApiTags('admin · experiencia')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/experience')
export class AdminExperienceController {
  constructor(
    private readonly list: ListExperienceUseCase,
    private readonly get: GetExperienceUseCase,
    private readonly create: CreateExperienceUseCase,
    private readonly update: UpdateExperienceUseCase,
    private readonly remove: DeleteExperienceUseCase,
    private readonly reorder: ReorderExperienceUseCase,
  ) {}

  @Get()
  @Roles('admin', 'editor')
  async listAll() {
    return (await this.list.execute()).map(AdminPresenter.experienceItem)
  }

  @Post()
  @Roles('admin', 'editor')
  async createOne(@Body() body: CreateExperienceDto) {
    return AdminPresenter.experienceItem(await this.create.execute(body))
  }

  @Patch('reorder')
  @Roles('admin', 'editor')
  async reorderAll(@Body() body: ReorderDto) {
    return (await this.reorder.execute(body.ids)).map(AdminPresenter.experienceItem)
  }

  @Get(':id')
  @Roles('admin', 'editor')
  async getOne(@Param('id') id: string) {
    return AdminPresenter.experienceItem(await this.get.execute(id))
  }

  @Put(':id')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Edita una experiencia; `period.end: null` la deja en curso' })
  async updateOne(@Param('id') id: string, @Body() body: UpdateExperienceDto) {
    return AdminPresenter.experienceItem(await this.update.execute(id, body))
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(@Param('id') id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.remove.execute(id, actor)
  }
}

@ApiTags('admin · skills')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/skills')
export class AdminSkillsController {
  constructor(
    private readonly list: ListSkillCategoriesUseCase,
    private readonly get: GetSkillCategoryUseCase,
    private readonly create: CreateSkillCategoryUseCase,
    private readonly update: UpdateSkillCategoryUseCase,
    private readonly remove: DeleteSkillCategoryUseCase,
    private readonly reorder: ReorderSkillCategoriesUseCase,
    private readonly addItem: AddSkillItemUseCase,
    private readonly removeItem: RemoveSkillItemUseCase,
    private readonly reorderItems: ReorderSkillItemsUseCase,
  ) {}

  @Get()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Categorias con sus items; aqui los items SI llevan id' })
  async listAll() {
    return (await this.list.execute()).map(AdminPresenter.skillCategory)
  }

  @Post()
  @Roles('admin', 'editor')
  async createOne(@Body() body: CreateSkillCategoryDto) {
    return AdminPresenter.skillCategory(await this.create.execute(body))
  }

  @Patch('reorder')
  @Roles('admin', 'editor')
  async reorderAll(@Body() body: ReorderDto) {
    return (await this.reorder.execute(body.ids)).map(AdminPresenter.skillCategory)
  }

  @Get(':id')
  @Roles('admin', 'editor')
  @ApiParam({ name: 'id', example: 'backend' })
  async getOne(@Param('id') id: string) {
    return AdminPresenter.skillCategory(await this.get.execute(id))
  }

  @Put(':id')
  @Roles('admin', 'editor')
  @ApiOperation({
    summary: 'Edita titulo y acento de una categoria',
    description: 'Los items no se tocan aqui: tienen sus propias rutas con sus reglas.',
  })
  async updateOne(@Param('id') id: string, @Body() body: UpdateSkillCategoryDto) {
    return AdminPresenter.skillCategory(await this.update.execute(id, body))
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra la categoria y sus items — solo admin' })
  async deleteOne(@Param('id') id: string, @CurrentActor() actor: Actor): Promise<void> {
    await this.remove.execute(id, actor)
  }

  // --- Items de una categoria -------------------------------------------------
  // `items/reorder` antes que `items/:itemId`, por la misma razon de siempre.

  @Post(':id/items')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Agrega un skill al final de la categoria' })
  async addOneItem(@Param('id') id: string, @Body() body: SkillItemDto) {
    return AdminPresenter.skillCategory(await this.addItem.execute(id, body))
  }

  @Patch(':id/items/reorder')
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Reordena los skills de una categoria' })
  async reorderOneItems(@Param('id') id: string, @Body() body: ReorderDto) {
    return AdminPresenter.skillCategory(await this.reorderItems.execute(id, body.ids))
  }

  @Delete(':id/items/:itemId')
  @Roles('admin')
  @ApiOperation({
    summary: 'Quita un skill — solo admin',
    description: 'Una categoria no puede quedarse sin skills: el ultimo no se puede quitar.',
  })
  async removeOneItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentActor() actor: Actor,
  ) {
    return AdminPresenter.skillCategory(await this.removeItem.execute(id, itemId, actor))
  }
}

@ApiTags('admin · perfil')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/profile')
export class AdminProfileController {
  constructor(
    private readonly get: GetProfileUseCase,
    private readonly update: UpdateProfileUseCase,
  ) {}

  @Get()
  @Roles('admin', 'editor')
  @ApiOperation({ summary: 'Perfil bilingue completo' })
  async getOne() {
    return AdminPresenter.profile(await this.get.execute())
  }

  @Put()
  @Roles('admin', 'editor')
  @ApiOperation({
    summary: 'Edita el perfil',
    description:
      'No hay POST ni DELETE: hay exactamente un perfil, lo crea el seed, y borrarlo ' +
      'dejaria el portafolio sin nombre ni secciones.',
  })
  async updateOne(@Body() body: UpdateProfileDto) {
    return AdminPresenter.profile(await this.update.execute(body))
  }
}
