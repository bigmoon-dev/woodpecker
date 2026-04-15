/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { PluginManager } from '../plugin/plugin-manager';
import { ConfigReloadService } from '../core/config-reload.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: any;

  const mockAdminService = {
    findAllRoles: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    findAllPermissions: jest.fn(),
    updateRolePermissions: jest.fn(),
    removeRolePermission: jest.fn(),
    findAllUsers: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
  };

  const mockPluginManager = {
    getPluginSettings: jest.fn(),
    updatePluginSettings: jest.fn(),
  };

  const mockConfigReloadService = {
    findAll: jest.fn(),
    set: jest.fn(),
    reload: jest.fn(),
    maskValue: jest.fn((key: string, value: string) => value),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: PluginManager, useValue: mockPluginManager },
        { provide: ConfigReloadService, useValue: mockConfigReloadService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
  });

  it('GET /roles delegates to findAllRoles with pagination', async () => {
    adminService.findAllRoles.mockResolvedValueOnce({
      data: [{ id: 'r1' }],
      total: 1,
    });
    const result = await controller.findAllRoles({
      page: 2,
      pageSize: 10,
    } as any);
    expect(adminService.findAllRoles).toHaveBeenCalledWith(2, 10);
    expect(result.total).toBe(1);
  });

  it('POST /roles delegates to createRole', async () => {
    const dto = { name: 'teacher', description: 'desc' };
    adminService.createRole.mockResolvedValueOnce({ id: 'r1', ...dto });
    const result = await controller.createRole(dto as any);
    expect(adminService.createRole).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('r1');
  });

  it('PUT /roles/:id delegates to updateRole', async () => {
    const dto = { name: 'updated' };
    adminService.updateRole.mockResolvedValueOnce({ id: 'r1', ...dto });
    const result = await controller.updateRole('r1', dto as any);
    expect(adminService.updateRole).toHaveBeenCalledWith('r1', dto);
    expect(result.name).toBe('updated');
  });

  it('DELETE /roles/:id delegates to deleteRole', async () => {
    adminService.deleteRole.mockResolvedValueOnce(undefined);
    await controller.deleteRole('r1');
    expect(adminService.deleteRole).toHaveBeenCalledWith('r1');
  });

  it('GET /permissions delegates to findAllPermissions', async () => {
    adminService.findAllPermissions.mockResolvedValueOnce({
      data: [],
      total: 0,
    });
    const result = await controller.findAllPermissions({
      page: 1,
      pageSize: 20,
    } as any);
    expect(adminService.findAllPermissions).toHaveBeenCalledWith(1, 20);
  });

  it('PUT /roles/:id/permissions delegates to updateRolePermissions', async () => {
    const dto = { permissionIds: ['p1', 'p2'] };
    adminService.updateRolePermissions.mockResolvedValueOnce({ id: 'r1' });
    await controller.updateRolePermissions('r1', dto as any);
    expect(adminService.updateRolePermissions).toHaveBeenCalledWith('r1', [
      'p1',
      'p2',
    ]);
  });

  it('DELETE /roles/:id/permissions/:permissionId delegates to removeRolePermission', async () => {
    adminService.removeRolePermission.mockResolvedValueOnce({ id: 'r1' });
    await controller.removeRolePermission('r1', 'p1');
    expect(adminService.removeRolePermission).toHaveBeenCalledWith('r1', 'p1');
  });

  it('GET /users delegates to findAllUsers', async () => {
    adminService.findAllUsers.mockResolvedValueOnce({
      data: [],
      total: 0,
    });
    const result = await controller.findAllUsers({
      page: 1,
      pageSize: 20,
    } as any);
    expect(adminService.findAllUsers).toHaveBeenCalledWith(1, 20);
  });

  it('POST /users delegates to createUser', async () => {
    const dto = {
      username: 'test',
      password: 'pass',
      displayName: 'Test',
      roleIds: ['r1'],
    };
    adminService.createUser.mockResolvedValueOnce({ id: 'u1' });
    await controller.createUser(dto as any);
    expect(adminService.createUser).toHaveBeenCalledWith(dto);
  });

  it('PUT /users/:id delegates to updateUser', async () => {
    const dto = { displayName: 'New' };
    adminService.updateUser.mockResolvedValueOnce({ id: 'u1', ...dto });
    await controller.updateUser('u1', dto as any);
    expect(adminService.updateUser).toHaveBeenCalledWith('u1', dto);
  });

  it('DELETE /users/:id delegates to deleteUser', async () => {
    adminService.deleteUser.mockResolvedValueOnce(undefined);
    await controller.deleteUser('u1');
    expect(adminService.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('GET /config delegates to configReloadService.findAll with masking', async () => {
    mockConfigReloadService.findAll.mockResolvedValueOnce([
      { key: 'DATA_RETENTION_DAYS', value: '365', category: 'retention' },
    ]);
    mockConfigReloadService.maskValue.mockReturnValue('365');
    const result = await controller.listConfig();
    expect(mockConfigReloadService.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('PUT /config/:key delegates to configReloadService.set', async () => {
    mockConfigReloadService.set.mockResolvedValueOnce({
      key: 'DATA_RETENTION_DAYS',
      value: '180',
    });
    const result = await controller.updateConfig('DATA_RETENTION_DAYS', {
      value: '180',
      updatedBy: 'admin',
    });
    expect(mockConfigReloadService.set).toHaveBeenCalledWith(
      'DATA_RETENTION_DAYS',
      '180',
      'admin',
    );
    expect(result.value).toBe('180');
  });

  it('POST /config/reload triggers reload', async () => {
    const result = await controller.reloadConfig();
    expect(mockConfigReloadService.reload).toHaveBeenCalled();
    expect(result.status).toBe('ok');
  });
});
