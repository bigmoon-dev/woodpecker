/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Plugin } from '../../entities/plugin/plugin.entity';
import { PluginManager } from './plugin-manager';
import { HookBus } from './hook-bus';
import { IPlugin } from './plugin.interface';

describe('PluginManager', () => {
  let manager: PluginManager;

  const mockPluginRepo = {
    findOne: jest.fn(),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ ...data, id: 'p1' }),
    ),
  };

  const mockHookBus = {
    register: jest.fn(),
    unregisterByEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginManager,
        { provide: getRepositoryToken(Plugin), useValue: mockPluginRepo },
        { provide: HookBus, useValue: mockHookBus },
      ],
    }).compile();

    manager = module.get<PluginManager>(PluginManager);
  });

  describe('onModuleInit', () => {
    it('should register plugins that do not exist in DB', async () => {
      mockPluginRepo.findOne.mockResolvedValue(null);
      await manager.onModuleInit();
      expect(mockPluginRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should skip registration for existing plugins', async () => {
      mockPluginRepo.findOne.mockResolvedValue({
        name: 'excel-import',
        status: 'installed',
        config: {},
      });
      await manager.onModuleInit();
      expect(mockPluginRepo.save).toHaveBeenCalledTimes(0);
    });

    it('should call onEnable for enabled plugins with full PluginContext', async () => {
      mockPluginRepo.findOne.mockResolvedValue({
        name: 'excel-import',
        status: 'enabled',
        config: {},
      });
      await manager.onModuleInit();
    });

    it('should handle init errors gracefully', async () => {
      mockPluginRepo.findOne.mockRejectedValue(new Error('DB down'));
      await expect(manager.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('register', () => {
    it('should save and load a plugin', async () => {
      const plugin: IPlugin = {
        name: 'test-plugin',
        version: '1.0',
        description: 'Test',
        getSettingsSchema: () => ({ type: 'object' }),
      };
      const result = await manager.register(plugin);
      expect(result.name).toBe('test-plugin');
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });
  });

  describe('enable', () => {
    it('should enable a loaded plugin and register hooks', async () => {
      const onEnableMock = jest.fn();
      const handlerMock = jest.fn();
      const mockPlugin: IPlugin = {
        name: 'test-plugin',
        version: '1.0',
        description: 'Test',
        onEnable: onEnableMock,
        getHooks: () => [{ event: 'test', handler: handlerMock, priority: 1 }],
      };
      mockPluginRepo.findOne.mockResolvedValue({
        name: 'test-plugin',
        status: 'installed',
        config: {},
      });
      manager['loadedPlugins'].set('test-plugin', mockPlugin);

      await manager.enable('test-plugin');

      expect(onEnableMock).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.any(Object),

          logger: expect.objectContaining({
            info: expect.any(Function),
            error: expect.any(Function),
          }),
        }),
      );
      expect(mockHookBus.register).toHaveBeenCalled();
    });

    it('should throw for unknown plugin', async () => {
      await expect(manager.enable('unknown')).rejects.toThrow(
        'Plugin unknown not found',
      );
    });
  });

  describe('disable', () => {
    it('should disable a loaded plugin and unregister hooks', async () => {
      const onDisableMock = jest.fn();
      const handlerMock = jest.fn();
      const mockPlugin: IPlugin = {
        name: 'test-plugin',
        version: '1.0',
        description: 'Test',
        onDisable: onDisableMock,
        getHooks: () => [{ event: 'test', handler: handlerMock, priority: 1 }],
      };
      mockPluginRepo.findOne.mockResolvedValue({
        name: 'test-plugin',
        status: 'enabled',
      });
      manager['loadedPlugins'].set('test-plugin', mockPlugin);

      await manager.disable('test-plugin');

      expect(onDisableMock).toHaveBeenCalled();
      expect(mockHookBus.unregisterByEvent).toHaveBeenCalledWith('test');
    });
  });

  describe('getAllLoaded', () => {
    it('should return all loaded plugin names', () => {
      manager['loadedPlugins'].set('a', {} as IPlugin);
      manager['loadedPlugins'].set('b', {} as IPlugin);
      expect(manager.getAllLoaded()).toEqual(['a', 'b']);
    });
  });
});
