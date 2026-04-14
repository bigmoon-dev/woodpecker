/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { HookBus } from '../plugin/hook-bus';

describe('AuthController Hook emit', () => {
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HookBus, useValue: mockHookBus },
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
    it('valid refresh token returns new accessToken', () => {
      const decoded = {
        sub: 'u1',
        username: 'testuser',
        roles: ['admin'],
      };
      mockJwtService.verify.mockReturnValueOnce(decoded);
      mockJwtService.sign.mockReturnValueOnce('new-access-token');

      const result = controller.refresh({ refreshToken: 'valid-token' });

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'u1', username: 'testuser', roles: ['admin'] },
        { expiresIn: '15m' },
      );
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('invalid refresh token throws UnauthorizedException', () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      expect(() => controller.refresh({ refreshToken: 'bad-token' })).toThrow(
        UnauthorizedException,
      );
    });
  });
});
