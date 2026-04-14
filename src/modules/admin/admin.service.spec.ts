/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { Permission } from '../../entities/auth/permission.entity';
import { In } from 'typeorm';
import { AuthService } from '../auth/auth.service';

describe('AdminService', () => {
  let service: AdminService;
  let roleRepo: any;
  let userRepo: any;
  let permRepo: any;

  const mockRoleRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'r1' })),
    delete: jest.fn(),
    findBy: jest.fn(),
  };

  const mockUserRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'u1' })),
    delete: jest.fn(),
    update: jest.fn(),
  };

  const mockPermRepo = {
    findAndCount: jest.fn(),
    findBy: jest.fn(),
  };

  const mockAuthService = {
    hashPassword: jest.fn().mockResolvedValue('hashed'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Permission), useValue: mockPermRepo },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    roleRepo = module.get(getRepositoryToken(Role));
    userRepo = module.get(getRepositoryToken(User));
    permRepo = module.get(getRepositoryToken(Permission));
  });

  describe('updateRolePermissions', () => {
    it('should replace role permissions with new set', async () => {
      const mockPerms = [{ id: 'p1' }, { id: 'p2' }];
      roleRepo.findOne.mockResolvedValue({
        id: 'r1',
        permissions: [{ id: 'p0' }],
      });
      permRepo.findBy.mockResolvedValue(mockPerms);
      roleRepo.save.mockResolvedValue({ id: 'r1', permissions: mockPerms });

      await service.updateRolePermissions('r1', ['p1', 'p2']);
      expect(permRepo.findBy).toHaveBeenCalledWith({ id: In(['p1', 'p2']) });
      expect(roleRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing role', async () => {
      roleRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateRolePermissions('missing', []),
      ).rejects.toThrow('not found');
    });
  });

  describe('removeRolePermission', () => {
    it('should remove a single permission from role', async () => {
      const perms = [{ id: 'p1' }, { id: 'p2' }];
      roleRepo.findOne.mockResolvedValue({ id: 'r1', permissions: perms });
      roleRepo.save.mockResolvedValue({
        id: 'r1',
        permissions: [{ id: 'p2' }],
      });

      await service.removeRolePermission('r1', 'p1');
      expect(roleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ permissions: [{ id: 'p2' }] }),
      );
    });
  });

  describe('findAllPermissions', () => {
    it('should return paginated permissions', async () => {
      const perms = [{ id: 'p1', code: 'scale:read' }];
      permRepo.findAndCount.mockResolvedValue([perms, 1]);
      const result = await service.findAllPermissions(1, 20);
      expect(result).toEqual({ data: perms, total: 1 });
    });
  });

  describe('createUser', () => {
    it('should hash password and assign roles', async () => {
      roleRepo.findBy.mockResolvedValue([{ id: 'r1' }]);
      userRepo.save.mockResolvedValue({ id: 'u1', username: 'test' });

      await service.createUser({
        username: 'test',
        password: 'pass123',
        displayName: 'Test',
        roleIds: ['r1'],
      });
      expect(mockAuthService.hashPassword).toHaveBeenCalledWith('pass123');
    });
  });
});
