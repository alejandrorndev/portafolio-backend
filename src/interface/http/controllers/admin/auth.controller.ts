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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { GetCurrentUserUseCase, LoginUseCase, type LoginResult } from '@/application/auth/use-cases'
import {
  ChangeUserPasswordUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
} from '@/application/users/use-cases'
import type { Actor, PublicUser } from '@/domain/entities'
import { ChangePasswordDto, CreateUserDto, LoginDto, UpdateUserDto } from '@/interface/http/dto'
import { CurrentActor, JwtAuthGuard, Roles, RolesGuard } from '@/interface/http/guards'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly currentUser: GetCurrentUserUseCase,
  ) {}

  /*
   * El limitador se aplica SOLO aqui, con el limitador nombrado que declara
   * AuthModule (LOGIN_RATE_LIMIT por minuto, 5 por defecto). Global dejaria la
   * lectura publica del portafolio en cinco peticiones por minuto, que es absurdo
   * para un sitio.
   *
   * En Render el contenedor es persistente y de una sola instancia, asi que el
   * contador en memoria funciona. Esa es la diferencia con el front, que necesita
   * Upstash porque en Vercel cada invocacion arranca limpia.
   */
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia sesion',
    description:
      'Intentos limitados por minuto y por IP (LOGIN_RATE_LIMIT). El error es el mismo ' +
      'para credenciales ' +
      'incorrectas, correo inexistente y cuenta desactivada: distinguirlos convertiria ' +
      'este endpoint en un verificador de correos registrados.',
  })
  @ApiResponse({ status: 200, description: 'Token de acceso y usuario' })
  @ApiResponse({ status: 401, description: 'Credenciales invalidas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  async signIn(@Body() body: LoginDto): Promise<LoginResult> {
    return this.login.execute(body)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'El usuario del token, con sus datos actuales',
    description:
      'Consulta la base de datos a proposito: el token puede tener ocho horas, y el ' +
      'panel necesita el rol de ahora para decidir que botones mostrar.',
  })
  async me(@CurrentActor() actor: Actor): Promise<PublicUser> {
    return this.currentUser.execute(actor)
  }
}

@ApiTags('admin · usuarios')
@ApiBearerAuth('bearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly list: ListUsersUseCase,
    private readonly create: CreateUserUseCase,
    private readonly update: UpdateUserUseCase,
    private readonly changePassword: ChangeUserPasswordUseCase,
    private readonly remove: DeleteUserUseCase,
  ) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Usuarios, sin hashes de contraseña' })
  async listAll(@CurrentActor() actor: Actor): Promise<PublicUser[]> {
    return this.list.execute(actor)
  }

  @Post()
  @Roles('admin')
  @ApiOperation({
    summary: 'Crea un usuario',
    description: 'No hay registro publico: los usuarios los crea un administrador.',
  })
  async createOne(@CurrentActor() actor: Actor, @Body() body: CreateUserDto): Promise<PublicUser> {
    return this.create.execute(actor, body)
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Cambia el rol o activa/desactiva',
    description:
      'Nunca deja el sistema sin administradores: degradar, desactivar o borrar al ' +
      'ultimo admin activo devuelve 409.',
  })
  async updateOne(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
  ): Promise<PublicUser> {
    return this.update.execute(actor, id, body)
  }

  @Put(':id/password')
  @Roles('admin')
  @ApiOperation({
    summary: 'Cambia la contraseña de un usuario',
    description:
      'Es tambien la forma de cambiar la del admin inicial: las variables de entorno ' +
      'ADMIN_* se ignoran una vez existe el usuario.',
  })
  async setPassword(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: ChangePasswordDto,
  ): Promise<PublicUser> {
    return this.changePassword.execute(actor, id, body.password)
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borra un usuario' })
  async deleteOne(@CurrentActor() actor: Actor, @Param('id') id: string): Promise<void> {
    await this.remove.execute(actor, id)
  }
}
