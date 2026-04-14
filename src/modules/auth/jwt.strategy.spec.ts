/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../entities/auth/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepo: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    studentId: 'student-1',
    roles: [
      {
        name: 'teacher',
        permissions: [{ code: 'result:read' }, { code: 'task:write' }],
      },
    ],
  };

  beforeEach(async () => {
    const mockUserRepo = {
      findOne: jest.fn(),
    };
    const mockConfigService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userRepo = module.get(getRepositoryToken(User));
  });

  it('should return mapped user with roles and permissions', async () => {
    userRepo.findOne.mockResolvedValue(mockUser);
    const result = await strategy.validate({
      sub: 'user-1',
      username: 'testuser',
      roles: ['teacher'],
    });
    expect(result!).toEqual({
      id: 'user-1',
      username: 'testuser',
      studentId: 'student-1',
      roles: [
        {
          name: 'teacher',
          permissions: [{ code: 'result:read' }, { code: 'task:write' }],
        },
      ],
    });
  });

  it('should return null when user not found', async () => {
    userRepo.findOne.mockResolvedValue(null);
    const result = await strategy.validate({
      sub: 'nonexistent',
      username: 'ghost',
      roles: [],
    });
    expect(result!).toBeNull();
  });

  it('should handle user with no roles', async () => {
    const userNoRoles = {
      id: 'user-2',
      username: 'noroles',
      studentId: null,
      roles: [],
    };
    userRepo.findOne.mockResolvedValue(userNoRoles);
    const result = await strategy.validate({
      sub: 'user-2',
      username: 'noroles',
      roles: [],
    });
    expect(result!.roles).toEqual([]);
  });

  it('should handle user with multiple roles', async () => {
    const multiRoleUser = {
      id: 'user-3',
      username: 'multi',
      studentId: null,
      roles: [
        { name: 'admin', permissions: [{ code: 'result:all' }] },
        { name: 'teacher', permissions: [{ code: 'task:write' }] },
      ],
    };
    userRepo.findOne.mockResolvedValue(multiRoleUser);
    const result = await strategy.validate({
      sub: 'user-3',
      username: 'multi',
      roles: ['admin', 'teacher'],
    });
    expect(result!.roles).toHaveLength(2);
  });

  it('should pass correct userId to repo.findOne', async () => {
    userRepo.findOne.mockResolvedValue(mockUser);
    await strategy.validate({
      sub: 'user-1',
      username: 'testuser',
      roles: ['teacher'],
    });
    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('should handle user with null studentId', async () => {
    const staffUser = {
      id: 'user-4',
      username: 'staff',
      studentId: null,
      roles: [{ name: 'admin', permissions: [{ code: 'result:all' }] }],
    };
    userRepo.findOne.mockResolvedValue(staffUser);
    const result = await strategy.validate({
      sub: 'user-4',
      username: 'staff',
      roles: ['admin'],
    });
    expect(result!.studentId).toBeNull();
  });
});
