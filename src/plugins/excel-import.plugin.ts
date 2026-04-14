import { IPlugin } from '../modules/plugin/plugin.interface';

export class ExcelImportPlugin implements IPlugin {
  name = 'excel-import';
  version = '1.0.0';
  description = 'Import scales from Excel (.xlsx) files';

  onInstall(): void {}

  onEnable(): void {}

  onDisable(): void {}

  onUninstall(): void {}

  getHooks() {
    return [];
  }

  getRoutes() {
    return [
      {
        method: 'POST',
        path: '/api/scales/import',
        handler: 'importScale',
        description: 'Upload and parse Excel scale template',
        controller: 'ScaleController',
      },
      {
        method: 'GET',
        path: '/api/scales/import/template',
        handler: 'downloadTemplate',
        description: 'Download Excel scale template',
      },
    ];
  }

  getMenuItems() {
    return [
      {
        path: '/admin/scales/import',
        label: 'Excel导入',
        icon: 'upload',
      },
    ];
  }

  getSettingsSchema() {
    return {
      type: 'object',
      properties: {
        maxFileSize: {
          type: 'number',
          default: 10485760,
          description: 'Maximum upload file size in bytes',
        },
      },
    };
  }
}
