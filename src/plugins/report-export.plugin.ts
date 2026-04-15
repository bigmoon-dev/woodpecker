/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  IPlugin,
  HookDefinition,
  PluginContext,
} from '../modules/plugin/plugin.interface';

interface ExportServiceLike {
  generatePdf(resultId: string): Promise<Buffer>;
  generateExcel(results: unknown[]): Promise<Buffer>;
}

export class ReportExportPlugin implements IPlugin {
  name = 'report-export';
  version = '1.0.0';
  description = 'Export assessment results as Excel or PDF reports';

  private exportService: ExportServiceLike | null = null;
  private config: Record<string, any> = {};
  private logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  } = {
    info: (msg) => console.log(`[ReportExportPlugin] ${msg}`),
    error: (msg) => console.error(`[ReportExportPlugin] ${msg}`),
  };

  setExportService(service: ExportServiceLike): void {
    this.exportService = service;
  }

  onInstall(ctx: PluginContext): void {
    if (ctx) {
      this.config = ctx.config || {};
      this.logger = ctx.logger || this.logger;
    }
  }

  onEnable(ctx: PluginContext): void {
    if (ctx) {
      this.config = ctx.config || {};
      this.logger = ctx.logger || this.logger;
    }
  }

  onDisable(): void {}

  onUninstall(): void {}

  getHooks(): HookDefinition[] {
    return [
      {
        event: 'on:result.calculated',
        handler: async (result: unknown) => {
          const r = result as { id?: string } | null;
          if (!r?.id || !this.exportService) {
            return;
          }
          try {
            const format = this.config.format || 'excel';
            if (format === 'pdf') {
              await this.exportService.generatePdf(r.id);
              this.logger.info(`Auto-exported result ${r.id} as PDF`);
            } else {
              this.logger.info(
                `Auto-export queued for result ${r.id} as Excel (requires filter context)`,
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Auto-export failed for result ${r.id}: ${msg}`);
          }
        },
        priority: 10,
      },
    ];
  }

  getRoutes() {
    return [
      {
        method: 'GET',
        path: '/api/export/excel/task/:taskId',
        handler: 'exportTaskExcel',
        description: 'Export task results as Excel file',
        controller: 'ExportController',
      },
      {
        method: 'POST',
        path: '/api/export/excel',
        handler: 'exportExcelByFilter',
        description: 'Export filtered results as Excel file',
        controller: 'ExportController',
      },
      {
        method: 'GET',
        path: '/api/export/pdf/:resultId',
        handler: 'exportResultPdf',
        description: 'Export single result as PDF',
        controller: 'ExportController',
      },
    ];
  }

  getMenuItems() {
    return [
      {
        path: '/admin/export',
        label: '报表导出',
        icon: 'file-excel',
      },
    ];
  }

  getSettingsSchema() {
    return {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['excel', 'pdf'],
          default: 'excel',
          description: 'Default export format',
        },
        includeSuggestions: {
          type: 'boolean',
          default: true,
          description: 'Include assessment suggestions in export',
        },
        includeDimensions: {
          type: 'boolean',
          default: true,
          description: 'Include dimension-level scores in export',
        },
      },
    };
  }
}
