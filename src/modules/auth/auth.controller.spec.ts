/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { HookBus } from '../plugin/hook-bus';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefreshToken } from '../../entities/auth/refresh-token.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let hookBus: any;
  let authService: any;

  const mockAuthService = {
    validateUser: jest.fn(),
  };
  const mockJwtService = {
    sign: jest.fn().mockReturnValue('token'),
    verify: jest.fn(),
  };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };
  const mockRefreshTokenRepo = {
    save: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn((data: unknown) => data),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HookBus, useValue: mockHookBus },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    hookBus = module.get(HookBus);
    authService = module.get(AuthService);
  });

  it('should emit on:user.login after successful login', async () => {
    const mockUser = {
      id: 'u1',
      username: 'testuser',
      displayName: 'Test User',
      roles: [{ name: 'admin' }],
    };
    authService.validateUser.mockResolvedValueOnce(mockUser);

    await controller.login({ username: 'testuser', password: 'password' }, {
      ip: '127.0.0.1',
    } as any);

    expect(hookBus.emit).toHaveBeenCalledWith(
      'on:user.login',
      expect.objectContaining({
        userId: 'u1',
        roles: ['admin'],
        ip: '127.0.0.1',
      }),
    );
  });

  it('should not emit on:user.login when credentials are invalid', async () => {
    authService.validateUser.mockResolvedValueOnce(null);

    await expect(
      controller.login({ username: 'bad', password: 'bad' }, {
        ip: '127.0.0.1',
      } as any),
    ).rejects.toThrow(UnauthorizedException);

    expect(hookBus.emit).not.toHaveBeenCalled();
  });

  it('should not throw when on:user.login hook emit fails', async () => {
    const mockUser = {
      id: 'u1',
      username: 'testuser',
      displayName: 'Test User',
      roles: [{ name: 'admin' }],
    };
    authService.validateUser.mockResolvedValueOnce(mockUser);
    mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));

    const result = await controller.login(
      { username: 'testuser', password: 'password' },
      { ip: '127.0.0.1' } as any,
    );

    expect(result).toBeDefined();
    expect(result.accessToken).toBe('token');
  });

  describe('refresh()', () => {
    it('valid refresh token returns new tokens (rotation)', async () => {
      const decoded = {
        sub: 'u1',
        username: 'testuser',
        roles: ['admin'],
      };
      mockJwtService.verify.mockReturnValueOnce(decoded);
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        id: 'rt1',
        tokenHash:
          '397a2a9c5bf5e2ccec38c2596b682bb1bd05fe6e4ecea6c10cf42755ff225403',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await controller.refresh({ refreshToken: 'valid-token' });

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        'rt1',
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
    });

    it('invalid refresh token throws UnauthorizedException', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      await expect(
        controller.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('revoked refresh token throws UnauthorizedException', async () => {
      const decoded = {
        sub: 'u1',
        username: 'testuser',
        roles: ['admin'],
      };
      mockJwtService.verify.mockReturnValueOnce(decoded);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        controller.refresh({ refreshToken: 'revoked-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout()', () => {
    it('should revoke refresh token', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        sub: 'u1',
        username: 'testuser',
        roles: ['admin'],
      });

      const result = await controller.logout({ refreshToken: 'valid-token' });

      expect(result).toEqual({ success: true });
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { tokenHash: expect.any(String), revokedAt: expect.anything() },
        { revokedAt: expect.any(Date) },
      );
    });

    it('should return success even for invalid token', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      const result = await controller.logout({ refreshToken: 'bad-token' });
      expect(result).toEqual({ success: true });
    });
  });
});
