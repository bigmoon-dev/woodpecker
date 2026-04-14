import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { PluginManager } from './plugin-manager';
import { Plugin } from '../../entities/plugin/plugin.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';
import { SetMetadata } from '@nestjs/common';

@Controller('api/admin/plugins')
@UseGuards(JwtAuthGuard, RbacGuard)
@SetMetadata(REQUIRE_PERMISSION, ['plugin:read'])
export class PluginController {
  constructor(private pluginManager: PluginManager) {}

  @Get()
  findAll() {
    return { loaded: this.pluginManager.getAllLoaded() };
  }

  @Post(':name/enable')
  @SetMetadata(REQUIRE_PERMISSION, ['plugin:write'])
  async enable(@Param('name') name: string) {
    await this.pluginManager.enable(name);
    return { enabled: true };
  }

  @Post(':name/disable')
  @SetMetadata(REQUIRE_PERMISSION, ['plugin:write'])
  async disable(@Param('name') name: string) {
    await this.pluginManager.disable(name);
    return { disabled: true };
  }
}
