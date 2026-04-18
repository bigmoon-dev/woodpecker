/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../../entities/auth/user.entity';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: 'u1',
    username: 'admin',
    password: 'hashed',
    displayName: 'Admin',
    status: 'active',
    failedLoginCount: 0,
    lockedUntil: null,
    roles: [],
    studentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as User;
}

describe('AuthService - Account Lockout', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    userRepo = { findOne: jest.fn(), save: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('increments failedLoginCount on wrong password', async () => {
    const user = makeUser({ failedLoginCount: 2 });
    userRepo.findOne.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(false as never);
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));

    await service.validateUser('admin', 'wrong');

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginCount: 3 }),
    );
  });

  it('locks account after 5 consecutive failures', async () => {
    const user = makeUser({ failedLoginCount: 4 });
    userRepo.findOne.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(false as never);
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));

    await service.validateUser('admin', 'wrong');

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginCount: 5,
        lockedUntil: expect.any(Date),
      }),
    );
  });

  it('rejects login when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    const user = makeUser({ failedLoginCount: 5, lockedUntil });
    userRepo.findOne.mockResolvedValue(user);

    await expect(service.validateUser('admin', 'anypassword')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('resets failedLoginCount on successful login', async () => {
    const user = makeUser({ failedLoginCount: 3 });
    userRepo.findOne.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));

    const result = await service.validateUser('admin', 'correct');

    expect(result).toBe(user);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginCount: 0,
        lockedUntil: null,
      }),
    );
  });

  it('unlocks account after lockout period expires', async () => {
    const lockedUntil = new Date(Date.now() - 1000);
    const user = makeUser({ failedLoginCount: 5, lockedUntil });
    userRepo.findOne.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    userRepo.save.mockImplementation((u: unknown) => Promise.resolve(u));

    const result = await service.validateUser('admin', 'correct');

    expect(result).toBe(user);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginCount: 0,
        lockedUntil: null,
      }),
    );
  });

  it('verifyPassword returns true for correct password', async () => {
    userRepo.findOne.mockResolvedValue(makeUser());
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.verifyPassword('u1', 'correct');
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    userRepo.findOne.mockResolvedValue(makeUser());
    mockedBcrypt.compare.mockResolvedValue(false as never);

    const result = await service.verifyPassword('u1', 'wrong');
    expect(result).toBe(false);
  });

  it('verifyPassword returns false for non-existent user', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.verifyPassword('missing', 'pass');
    expect(result).toBe(false);
  });

  it('lockout message contains remaining minutes', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const user = makeUser({ failedLoginCount: 5, lockedUntil });
    userRepo.findOne.mockResolvedValue(user);

    try {
      await service.validateUser('admin', 'pass');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const response = (err as UnauthorizedException).getResponse();
      expect(JSON.stringify(response)).toContain('Account locked');
    }
  });
});
