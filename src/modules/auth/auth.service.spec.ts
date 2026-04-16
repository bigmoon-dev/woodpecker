import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../../entities/auth/user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepo = { findOne: jest.fn(), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('validateUser()', () => {
    it('returns user when credentials are valid', async () => {
      const user = {
        id: 'u1',
        username: 'admin',
        password: 'hashed',
        roles: [],
      } as unknown as User;
      userRepo.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('admin', 'pass');
      expect(result).toBe(user);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { username: 'admin', status: 'active' },
        relations: ['roles', 'roles.permissions'],
      });
    });

    it('returns null when password is invalid', async () => {
      const user = {
        id: 'u1',
        username: 'admin',
        password: 'hashed',
        roles: [],
      } as unknown as User;
      userRepo.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('admin', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nobody', 'pass');
      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('getPermissions()', () => {
    it('returns unique permission codes from roles', async () => {
      const user = {
        id: 'u1',
        roles: [
          {
            permissions: [{ code: 'read' }, { code: 'write' }],
          },
          {
            permissions: [{ code: 'write' }, { code: 'delete' }],
          },
        ],
      } as unknown as User;
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.getPermissions('u1');
      expect(result.sort()).toEqual(['delete', 'read', 'write']);
    });

    it('returns empty array when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.getPermissions('missing');
      expect(result).toEqual([]);
    });
  });

  describe('hashPassword()', () => {
    it('returns a bcrypt hash', async () => {
      mockedBcrypt.hash.mockResolvedValue('$2b$10$hashedvalue' as never);

      const result = await service.hashPassword('mypassword');
      expect(result).toBe('$2b$10$hashedvalue');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('mypassword', 10);
    });
  });
});
