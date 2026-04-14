export interface PluginRoute {
  method: string;
  path: string;
  handler: string;
  description?: string;
  controller?: string;
}

export interface IPlugin {
  name: string;
  version: string;
  description: string;
  onInstall?(ctx: PluginContext): void | Promise<void>;
  onEnable?(ctx: PluginContext): void | Promise<void>;
  onDisable?(): void | Promise<void>;
  onUninstall?(): void | Promise<void>;
  getHooks?(): HookDefinition[];
  getRoutes?(): PluginRoute[];
  getMenuItems?(): MenuItem[];
  getSettingsSchema?(): Record<string, any>;
}

export interface PluginContext {
  config: Record<string, any>;
  logger: { info(msg: string): void; error(msg: string): void };
}

export interface HookDefinition {
  event: string;
  handler: (...args: any[]) => void | Promise<void>;
  priority: number;
}

export interface MenuItem {
  path: string;
  label: string;
  icon?: string;
}
