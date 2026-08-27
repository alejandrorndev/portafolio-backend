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
import { DatabaseModule } from './database.module'

/*
 * Los casos de uso del contenido.
 *
 * El modulo no tiene controllers todavia: los expone la capa HTTP en la Etapa 5.
 * Registrarlos ya permite que el seed y los tests de integracion los usen, que es
 * como se comprueba que el cableado con los repositorios funciona antes de
 * agregarle HTTP encima.
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
  imports: [DatabaseModule],
  providers: USE_CASES,
  exports: USE_CASES,
})
export class ContentModule {}
