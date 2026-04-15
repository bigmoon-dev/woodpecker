import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plugin } from '../../entities/plugin/plugin.entity';
import { IPlugin, PluginContext, PluginRoute } from './plugin.interface';
import { HookBus } from './hook-bus';
import { ExcelImportPlugin } from '../../plugins/excel-import.plugin';
import { ReportExportPlugin } from '../../plugins/report-export.plugin';

@Injectable()
export class PluginManager implements OnModuleInit {
  private loadedPlugins: Map<string, IPlugin> = new Map();
  private registeredRoutes: Map<string, PluginRoute[]> = new Map();

  constructor(
    @InjectRepository(Plugin)
    private pluginRepo: Repository<Plugin>,
    private hookBus: HookBus,
  ) {}

  async onModuleInit() {
    const plugins: IPlugin[] = [
      new ExcelImportPlugin(),
      new ReportExportPlugin(),
    ];
    for (const plugin of plugins) {
      try {
        const existing = await this.pluginRepo.findOne({
          where: { name: plugin.name },
        });
        if (!existing) {
          await this.register(plugin);
        }
        if (existing?.status === 'enabled') {
          await plugin.onEnable?.({
            config: existing.config || {},
            logger: {
              info: (msg) => console.log(`[Plugin:${plugin.name}] ${msg}`),
              error: (msg) => console.error(`[Plugin:${plugin.name}] ${msg}`),
            },
          });
        }
      } catch (err) {
        console.error(`Failed to init plugin ${plugin.name}:`, err);
      }
    }
  }

  async register(plugin: IPlugin): Promise<Plugin> {
    const entity = this.pluginRepo.create({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      status: 'installed',
      settingsSchema: plugin.getSettingsSchema?.() || null,
    });
    const saved = await this.pluginRepo.save(entity);
    this.loadedPlugins.set(plugin.name, plugin);

    const routes = plugin.getRoutes?.() || [];
    if (routes.length > 0) {
      this.registeredRoutes.set(plugin.name, routes);
      this.registerRoutesToApplication(plugin.name, routes);
    }

    return saved;
  }

  private registerRoutesToApplication(
    pluginName: string,
    routes: PluginRoute[],
  ): void {
    for (const route of routes) {
      if (route.controller) continue;
      console.log(
        `[PluginManager] Registered route metadata: ${route.method} ${route.path} (plugin: ${pluginName})`,
      );
    }
  }

  async enable(name: string, config?: Record<string, any>): Promise<void> {
    const plugin = this.loadedPlugins.get(name);
    const entity = await this.pluginRepo.findOne({ where: { name } });
    if (!plugin || !entity) throw new Error(`Plugin ${name} not found`);

    const ctx: PluginContext = {
      config: { ...entity.config, ...config },
      logger: {
        info: (msg) => console.log(`[Plugin:${name}] ${msg}`),
        error: (msg) => console.error(`[Plugin:${name}] ${msg}`),
      },
    };

    try {
      await plugin.onEnable?.(ctx);
      const hooks = plugin.getHooks?.() || [];
      this.hookBus.register(hooks);

      const routes = plugin.getRoutes?.() || [];
      if (routes.length > 0) {
        this.registeredRoutes.set(plugin.name, routes);
        this.registerRoutesToApplication(plugin.name, routes);
      }

      entity.status = 'enabled';
      entity.config = ctx.config;
      await this.pluginRepo.save(entity);
    } catch (err) {
      console.error(`[PluginManager] Failed to enable ${name}:`, err);
      entity.status = 'error';
      await this.pluginRepo.save(entity);
    }
  }

  async disable(name: string): Promise<void> {
    const plugin = this.loadedPlugins.get(name);
    const entity = await this.pluginRepo.findOne({ where: { name } });
    if (!plugin || !entity) return;

    try {
      await plugin.onDisable?.();
      const hooks = plugin.getHooks?.() || [];
      for (const h of hooks) {
        this.hookBus.unregisterByEvent(h.event);
      }
      this.registeredRoutes.delete(name);
      entity.status = 'disabled';
      await this.pluginRepo.save(entity);
    } catch (err) {
      console.error(`[PluginManager] Error disabling ${name}:`, err);
    }
  }

  getPlugin(name: string): IPlugin | undefined {
    return this.loadedPlugins.get(name);
  }

  getAllLoaded(): string[] {
    return Array.from(this.loadedPlugins.keys());
  }

  getRoutes(name: string): PluginRoute[] {
    return this.registeredRoutes.get(name) || [];
  }

  getAllRoutes(): Map<string, PluginRoute[]> {
    return new Map(this.registeredRoutes);
  }

  async getPluginSettings(name: string): Promise<{
    schema: Record<string, any> | null;
    config: Record<string, any> | null;
  }> {
    const entity = await this.pluginRepo.findOne({ where: { name } });
    if (!entity) throw new Error(`Plugin ${name} not found`);
    return { schema: entity.settingsSchema, config: entity.config };
  }

  async updatePluginSettings(
    name: string,
    config: Record<string, any>,
  ): Promise<Plugin> {
    const entity = await this.pluginRepo.findOne({ where: { name } });
    if (!entity) throw new Error(`Plugin ${name} not found`);
    entity.config = config;
    return this.pluginRepo.save(entity);
  }
}
