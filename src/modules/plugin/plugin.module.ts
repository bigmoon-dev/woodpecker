import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plugin } from '../../entities/plugin/plugin.entity';
import { PluginManager } from './plugin-manager';
import { HookBus } from './hook-bus';
import { PluginController } from './plugin.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Plugin])],
  controllers: [PluginController],
  providers: [PluginManager, HookBus],
  exports: [PluginManager, HookBus],
})
export class PluginModule {}
