/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-floating-promises */
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;
  let superSpy: jest.SpyInstance;

  const makeContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => () => {},
      getClass: () => () => {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(guard));
    superSpy = jest.spyOn(proto, 'canActivate').mockReturnValue(true);
  });

  afterEach(() => {
    superSpy.mockRestore();
  });

  it('should return true for public endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(guard.canActivate(makeContext())).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('should delegate to super.canActivate for protected endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = makeContext();
    guard.canActivate(ctx);
    expect(superSpy).toHaveBeenCalledWith(ctx);
  });

  it('should delegate to super.canActivate when getAllAndOverride returns undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = makeContext();
    guard.canActivate(ctx);
    expect(superSpy).toHaveBeenCalled();
  });

  it('should not call super.canActivate when isPublic is true', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    guard.canActivate(makeContext());
    expect(superSpy).not.toHaveBeenCalled();
  });
});
