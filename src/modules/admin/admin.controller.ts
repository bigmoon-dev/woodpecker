import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateRolePermissionsDto,
} from './admin.dto';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { RequireReauth } from '../auth/reauth.decorator';
import { SetMetadata } from '@nestjs/common';
import { PluginManager } from '../plugin/plugin-manager';
import { ConfigReloadService } from '../core/config-reload.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['admin:all'])
export class AdminController {
  constructor(
    private adminService: AdminService,
    private pluginManager: PluginManager,
    private configReloadService: ConfigReloadService,
  ) {}

  @Get('roles')
  async findAllRoles(@Query() pagination: PaginationQueryDto) {
    return this.adminService.findAllRoles(pagination.page, pagination.pageSize);
  }

  @Post('roles')
  async createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto);
  }

  @Put('roles/:id')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequireReauth()
  async deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  @Get('permissions')
  async findAllPermissions(@Query() pagination: PaginationQueryDto) {
    return this.adminService.findAllPermissions(
      pagination.page,
      pagination.pageSize,
    );
  }

  @Put('roles/:id/permissions')
  async updateRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.adminService.updateRolePermissions(id, dto.permissionIds);
  }

  @Delete('roles/:id/permissions/:permissionId')
  @RequireReauth()
  async removeRolePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.adminService.removeRolePermission(id, permissionId);
  }

  @Get('users')
  async findAllUsers(@Query() pagination: PaginationQueryDto) {
    return this.adminService.findAllUsers(pagination.page, pagination.pageSize);
  }

  @Post('users')
  async createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @RequireReauth()
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('plugins/:name/settings')
  async getPluginSettings(@Param('name') name: string) {
    return this.pluginManager.getPluginSettings(name);
  }

  @Put('plugins/:name/settings')
  async updatePluginSettings(
    @Param('name') name: string,
    @Body() body: Record<string, any>,
  ) {
    return this.pluginManager.updatePluginSettings(name, body);
  }

  @Get('config')
  async listConfig() {
    const configs = await this.configReloadService.findAll();
    return configs.map((c) => ({
      ...c,
      value: this.configReloadService.maskValue(c.key, c.value),
    }));
  }

  @Put('config/:key')
  async updateConfig(
    @Param('key') key: string,
    @Body() body: { value: string; updatedBy: string },
  ) {
    return this.configReloadService.set(key, body.value, body.updatedBy);
  }

  @Post('config/reload')
  async reloadConfig() {
    await this.configReloadService.reload();
    return { status: 'ok' };
  }
}
