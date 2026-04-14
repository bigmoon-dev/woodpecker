import { IPlugin, HookDefinition } from '../modules/plugin/plugin.interface';

export class ReportExportPlugin implements IPlugin {
  name = 'report-export';
  version = '1.0.0';
  description = 'Export assessment results as text reports';

  onInstall(): void {}

  onEnable(): void {}

  onDisable(): void {}

  onUninstall(): void {}

  getHooks(): HookDefinition[] {
    return [
      {
        event: 'on:result.calculated',
        handler: (result: unknown) => {
          const r = result as { id?: string } | null;
          if (r?.id) {
            console.log(`[ReportExportPlugin] Cached result: ${r.id}`);
          }
        },
        priority: 10,
      },
    ];
  }

  getSettingsSchema() {
    return {
      type: 'object',
      properties: {
        includeSuggestions: {
          type: 'boolean',
          default: true,
        },
        format: {
          type: 'string',
          enum: ['text', 'json'],
          default: 'text',
        },
      },
    };
  }
}
