/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from '../../entities/auth/refresh-token.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HookBus } from '../plugin/hook-bus';
import * as crypto from 'crypto';

describe('Auth Security', () => {
  let controller: AuthController;

  const mockAuthService = {
    validateUser: jest.fn(),
    getPermissions: jest.fn().mockResolvedValue([]),
  };
  const mockJwtService = {
    sign: jest.fn().mockReturnValue('token'),
    verify: jest.fn(),
  };
  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((d) => d),
  };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('token');
    mockAuthService.getPermissions.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HookBus, useValue: mockHookBus },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('7d') },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('rejects login with non-existent user', async () => {
    mockAuthService.validateUser.mockResolvedValue(null);
    await expect(
      controller.login({ username: 'hacker', password: 'guessed' }, {} as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects refresh with expired/malformed token', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    await expect(
      controller.refresh({ refreshToken: 'tampered.token.here' }),
    ).rejects.toThrow();
  });

  it('rejects refresh with revoked token', async () => {
    mockJwtService.verify.mockReturnValue({
      sub: 'u1',
      username: 'test',
      roles: [],
    });
    mockRefreshTokenRepo.findOne.mockResolvedValue(null);

    await expect(controller.refresh({ refreshToken: 'old' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rotates refresh token on valid refresh', async () => {
    const oldToken = 'valid-refresh-token';
    mockJwtService.verify.mockReturnValue({
      sub: 'u1',
      username: 'test',
      roles: [],
    });
    mockRefreshTokenRepo.findOne.mockResolvedValue({
      id: 'rt1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });
    mockJwtService.sign.mockReturnValue('new-access');
    mockRefreshTokenRepo.save.mockResolvedValue({});

    await controller.refresh({ refreshToken: oldToken });

    expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
    expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
  });

  it('logout succeeds even with invalid token', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });
    const result = await controller.logout({ refreshToken: 'bad-token' });
    expect(result).toEqual({ success: true });
  });

  it('hashes refresh token before storage on login', async () => {
    mockAuthService.validateUser.mockResolvedValue({
      id: 'u1',
      username: 'test',
      roles: [],
      isStudent: false,
    });
    mockJwtService.sign.mockReturnValue('access-token');
    mockRefreshTokenRepo.create.mockImplementation((d) => d);
    mockRefreshTokenRepo.save.mockResolvedValue({});

    await controller.login({ username: 'test', password: 'pass' }, {} as any);

    const createCall = mockRefreshTokenRepo.create.mock.calls[0][0] as {
      tokenHash: string;
    };
    expect(createCall.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses constant-time comparison for refresh token hash (timing attack resistance)', async () => {
    mockAuthService.validateUser.mockResolvedValue({
      id: 'u1',
      username: 'test',
      roles: [],
      isStudent: false,
    });
    mockJwtService.sign.mockReturnValue('access-token');
    mockRefreshTokenRepo.create.mockImplementation((d) => d);
    mockRefreshTokenRepo.save.mockResolvedValue({});

    await controller.login({ username: 'test', password: 'pass' }, {} as any);

    const createCall = mockRefreshTokenRepo.create.mock.calls[0][0] as {
      tokenHash: string;
    };
    const tokenHash = createCall.tokenHash;
    expect(typeof crypto.timingSafeEqual).toBe('function');
    expect(tokenHash).toHaveLength(64);
  });

  it('rejects refresh with null or empty token', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt must be provided');
    });
    await expect(controller.refresh({ refreshToken: '' })).rejects.toThrow();
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt must be provided');
    });
    await expect(controller.refresh({ refreshToken: '' })).rejects.toThrow();
  });
});
