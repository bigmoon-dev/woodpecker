/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard, REQUIRE_PERMISSION } from './rbac.guard';
import { ExecutionContext } from '@nestjs/common';

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RbacGuard(reflector);
  });

  const makeContext = (user?: any): ExecutionContext => {
    const request: any = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  it('should return true when no permissions required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('should return true when required is empty array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('should throw ForbiddenException when no user on request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException when user lacks required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      roles: [{ name: 'student', permissions: [{ code: 'task:submit' }] }],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('should return true when user has all required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      roles: [{ name: 'teacher', permissions: [{ code: 'result:read' }] }],
    };
    const ctx = makeContext(user);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().dataScope).toBeDefined();
  });

  it('should compute scope=all when user has *:all permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      roles: [
        {
          name: 'admin',
          permissions: [{ code: 'result:read' }, { code: 'result:all' }],
        },
      ],
    };
    const ctx = makeContext(user);
    guard.canActivate(ctx);
    expect(ctx.switchToHttp().getRequest().dataScope.scope).toBe('all');
  });

  it('should compute scope=grade when user has *:grade but not *:all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      gradeId: 'g1',
      roles: [
        {
          name: 'psychologist',
          permissions: [{ code: 'result:read' }, { code: 'result:grade' }],
        },
      ],
    };
    const ctx = makeContext(user);
    guard.canActivate(ctx);
    expect(ctx.switchToHttp().getRequest().dataScope.scope).toBe('grade');
  });

  it('should compute scope=class when user has *:class but not *:grade or *:all', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      classId: 'c1',
      roles: [
        {
          name: 'teacher',
          permissions: [{ code: 'result:read' }, { code: 'result:class' }],
        },
      ],
    };
    const ctx = makeContext(user);
    guard.canActivate(ctx);
    expect(ctx.switchToHttp().getRequest().dataScope.scope).toBe('class');
  });

  it('should default scope=own when no scope-level permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = {
      id: 'u1',
      roles: [{ name: 'student', permissions: [{ code: 'result:read' }] }],
    };
    const ctx = makeContext(user);
    guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    expect(req.dataScope.scope).toBe('own');
    expect(req.dataScope.userId).toBe('u1');
  });

  it('should handle user with empty roles array', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:read']);
    const user = { id: 'u1', roles: [] };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });
});
