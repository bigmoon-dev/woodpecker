/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { PluginController } from './plugin.controller';
import { PluginManager } from './plugin-manager';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('PluginController', () => {
  let controller: PluginController;
  let pluginManager: any;

  const mockPluginManager = {
    getAllLoaded: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PluginController],
      providers: [{ provide: PluginManager, useValue: mockPluginManager }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PluginController>(PluginController);
    pluginManager = module.get(PluginManager);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET / should return loaded plugins', () => {
    mockPluginManager.getAllLoaded.mockReturnValueOnce([
      'excel-import',
      'pdf-export',
    ]);
    const result = controller.findAll();
    expect(result).toEqual({ loaded: ['excel-import', 'pdf-export'] });
    expect(pluginManager.getAllLoaded).toHaveBeenCalled();
  });

  it('POST /:name/enable should enable plugin', async () => {
    mockPluginManager.enable.mockResolvedValueOnce(undefined);
    const result = await controller.enable('excel-import');
    expect(result).toEqual({ enabled: true });
    expect(pluginManager.enable).toHaveBeenCalledWith('excel-import');
  });

  it('POST /:name/disable should disable plugin', async () => {
    mockPluginManager.disable.mockResolvedValueOnce(undefined);
    const result = await controller.disable('pdf-export');
    expect(result).toEqual({ disabled: true });
    expect(pluginManager.disable).toHaveBeenCalledWith('pdf-export');
  });
});
