/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
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
});
