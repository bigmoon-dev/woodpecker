import { ReportExportPlugin } from './report-export.plugin';

describe('ReportExportPlugin', () => {
  let plugin: ReportExportPlugin;

  beforeEach(() => {
    plugin = new ReportExportPlugin();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('report-export');
    expect(plugin.version).toBe('1.0.0');
  });

  it('returns hooks with on:result.calculated event', () => {
    const hooks = plugin.getHooks();
    expect(hooks.length).toBe(1);
    expect(hooks[0].event).toBe('on:result.calculated');
    expect(hooks[0].priority).toBe(10);
  });

  it('hook handler calls generatePdf when format is pdf', async () => {
    const mockExportService = {
      generatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      generateExcel: jest.fn(),
    };
    plugin.setExportService(mockExportService);
    plugin.onEnable({
      config: { format: 'pdf' },
      logger: { info: jest.fn(), error: jest.fn() },
    });

    const hooks = plugin.getHooks();
    await hooks[0].handler({ id: 'result-123' });

    expect(mockExportService.generatePdf).toHaveBeenCalledWith('result-123');
  });

  it('hook handler logs queued message when format is excel', async () => {
    const mockExportService = {
      generateExcel: jest.fn(),
      generatePdf: jest.fn(),
    };
    plugin.setExportService(mockExportService);
    const infoSpy = jest.fn();
    plugin.onEnable({
      config: { format: 'excel' },
      logger: { info: infoSpy, error: jest.fn() },
    });

    const hooks = plugin.getHooks();
    await hooks[0].handler({ id: 'result-456' });

    expect(mockExportService.generateExcel).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('result-456'));
  });

  it('hook handler handles null result gracefully', async () => {
    const mockExportService = {
      generatePdf: jest.fn(),
      generateExcel: jest.fn(),
    };
    plugin.setExportService(mockExportService);

    const hooks = plugin.getHooks();
    await expect(hooks[0].handler(null)).resolves.toBeUndefined();
    expect(mockExportService.generatePdf).not.toHaveBeenCalled();
  });

  it('hook handler handles export service error gracefully', async () => {
    const mockExportService = {
      generatePdf: jest.fn().mockRejectedValue(new Error('DB down')),
      generateExcel: jest.fn(),
    };
    plugin.setExportService(mockExportService);
    const errorSpy = jest.fn();
    plugin.onEnable({
      config: { format: 'pdf' },
      logger: { info: jest.fn(), error: errorSpy },
    });

    const hooks = plugin.getHooks();
    await hooks[0].handler({ id: 'result-789' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Auto-export failed'),
    );
  });

  it('returns export routes', () => {
    const routes = plugin.getRoutes();
    expect(routes.length).toBe(3);
    expect(routes[0].path).toBe('/api/export/excel/task/:taskId');
    expect(routes[1].path).toBe('/api/export/excel');
    expect(routes[2].path).toBe('/api/export/pdf/:resultId');
  });

  it('returns menu items', () => {
    const items = plugin.getMenuItems();
    expect(items.length).toBe(1);
    expect(items[0].label).toBe('报表导出');
    expect(items[0].path).toBe('/admin/export');
  });

  it('returns settings schema with format, includeSuggestions, includeDimensions', () => {
    const schema = plugin.getSettingsSchema();
    expect(schema.type).toBe('object');
    expect(schema.properties.format.enum).toEqual(['excel', 'pdf']);
    expect(schema.properties.includeSuggestions.type).toBe('boolean');
    expect(schema.properties.includeDimensions.type).toBe('boolean');
  });

  it('lifecycle hooks do not throw', () => {
    expect(() =>
      plugin.onInstall({
        config: {},
        logger: { info: jest.fn(), error: jest.fn() },
      }),
    ).not.toThrow();
    expect(() =>
      plugin.onEnable({
        config: {},
        logger: { info: jest.fn(), error: jest.fn() },
      }),
    ).not.toThrow();
    expect(() => plugin.onDisable()).not.toThrow();
    expect(() => plugin.onUninstall()).not.toThrow();
  });
});
