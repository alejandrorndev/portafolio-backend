import { Module } from '@nestjs/common'
import {
  AddSkillItemUseCase,
  CreateExperienceUseCase,
  CreateProfileUseCase,
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
import {
  AdminExperienceController,
  AdminProfileController,
  AdminProjectsController,
  AdminSkillsController,
} from '@/interface/http/controllers/admin/content.admin.controller'
import {
  PublicExperienceController,
  PublicProfileController,
  PublicProjectsController,
  PublicSkillsController,
} from '@/interface/http/controllers/public/content.controller'
import { AuthModule } from './auth.module'
import { DatabaseModule } from './database.module'

/*
 * Los casos de uso del contenido y sus dos caras HTTP.
 *
 * Los controllers publicos y los de admin viven en el mismo modulo a proposito:
 * comparten los casos de uso, y separarlos en dos modulos obligaria a registrar
 * los mismos proveedores dos veces.
 */
const USE_CASES = [
  ListProjectsUseCase,
  GetProjectUseCase,
  CreateProjectUseCase,
  UpdateProjectUseCase,
  DeleteProjectUseCase,
  ReorderProjectsUseCase,

  ListExperienceUseCase,
  GetExperienceUseCase,
  CreateExperienceUseCase,
  UpdateExperienceUseCase,
  DeleteExperienceUseCase,
  ReorderExperienceUseCase,

  ListSkillCategoriesUseCase,
  GetSkillCategoryUseCase,
  CreateSkillCategoryUseCase,
  UpdateSkillCategoryUseCase,
  DeleteSkillCategoryUseCase,
  ReorderSkillCategoriesUseCase,

  AddSkillItemUseCase,
  RemoveSkillItemUseCase,
  ReorderSkillItemsUseCase,

  GetProfileUseCase,
  UpdateProfileUseCase,
  CreateProfileUseCase,
]

@Module({
  // AuthModule aporta los guards que protegen las rutas de admin.
  imports: [DatabaseModule, AuthModule],
  controllers: [
    PublicProfileController,
    PublicProjectsController,
    PublicExperienceController,
    PublicSkillsController,
    AdminProfileController,
    AdminProjectsController,
    AdminExperienceController,
    AdminSkillsController,
  ],
  providers: USE_CASES,
  exports: USE_CASES,
})
export class ContentModule {}
