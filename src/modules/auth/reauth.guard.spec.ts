/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { ReauthGuard } from './reauth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('ReauthGuard', () => {
  let guard: ReauthGuard;
  let reflector: Reflector;
  let jwtService: JwtService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = {
      verify: jest.fn(),
    } as unknown as JwtService;
    guard = new ReauthGuard(reflector, jwtService);
  });

  function makeContext(
    overrides: {
      requireReauth?: boolean;
      headers?: Record<string, string | undefined>;
      user?: { id: string };
    } = {},
  ) {
    const handler = jest.fn();
    const clazz = jest.fn();
    if (overrides.requireReauth !== false) {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(overrides.requireReauth ?? true);
    } else {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    }
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: overrides.headers ?? {},
          user: overrides.user,
        }),
      }),
      getHandler: () => handler,
      getClass: () => clazz,
    } as any;
  }

  it('allows request when @RequireReauth is not set', () => {
    const ctx = makeContext({ requireReauth: false });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws when X-Reauth-Token header is missing', () => {
    const ctx = makeContext({ headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws when reauth token is invalid', () => {
    (jwtService.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const ctx = makeContext({
      headers: { 'x-reauth-token': 'bad-token' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws when token does not have reauth claim', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'u1',
      reauth: false,
    });
    const ctx = makeContext({
      headers: { 'x-reauth-token': 'valid-but-not-reauth' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws when reauth token belongs to different user', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'u2',
      reauth: true,
    });
    const ctx = makeContext({
      headers: { 'x-reauth-token': 'other-user-token' },
      user: { id: 'u1' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('allows request with valid reauth token matching current user', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'u1',
      reauth: true,
    });
    const ctx = makeContext({
      headers: { 'x-reauth-token': 'valid-reauth-token' },
      user: { id: 'u1' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows request with valid reauth token when no user on request', () => {
    (jwtService.verify as jest.Mock).mockReturnValue({
      sub: 'u1',
      reauth: true,
    });
    const ctx = makeContext({
      headers: { 'x-reauth-token': 'valid-reauth-token' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
