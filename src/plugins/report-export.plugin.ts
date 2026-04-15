import { IPlugin, HookDefinition } from '../modules/plugin/plugin.interface';

export class ReportExportPlugin implements IPlugin {
  name = 'report-export';
  version = '1.0.0';
  description = 'Export assessment results as Excel or PDF reports';

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
            console.log(
              `[ReportExportPlugin] Result cached for export: ${r.id}`,
            );
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
