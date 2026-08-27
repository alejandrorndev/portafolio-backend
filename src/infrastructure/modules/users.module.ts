import { Module } from '@nestjs/common'
import {
  ChangeUserPasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  EnsureBootstrapAdminUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
} from '@/application/users/use-cases'
import { BootstrapAdminService } from '@/infrastructure/security/bootstrap-admin.service'
import { AuthModule } from './auth.module'
import { DatabaseModule } from './database.module'

const USE_CASES = [
  ListUsersUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  ChangeUserPasswordUseCase,
  DeleteUserUseCase,
  EnsureBootstrapAdminUseCase,
]

@Module({
  // AuthModule aporta el hasher: crear un usuario y cambiar una contraseña
  // necesitan hashear, y esa implementacion vive con la autenticacion.
  imports: [DatabaseModule, AuthModule],
  providers: [...USE_CASES, BootstrapAdminService],
  exports: USE_CASES,
})
export class UsersModule {}
