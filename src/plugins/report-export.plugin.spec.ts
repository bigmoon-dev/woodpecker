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

  it('hook handler logs result id without throwing', () => {
    const hooks = plugin.getHooks();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    expect(() => hooks[0].handler({ id: 'test-id' })).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-id'));
    consoleSpy.mockRestore();
  });

  it('hook handler handles null result gracefully', () => {
    const hooks = plugin.getHooks();
    expect(() => hooks[0].handler(null)).not.toThrow();
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
    expect(() => plugin.onInstall()).not.toThrow();
    expect(() => plugin.onEnable()).not.toThrow();
    expect(() => plugin.onDisable()).not.toThrow();
    expect(() => plugin.onUninstall()).not.toThrow();
  });
});
