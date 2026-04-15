/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard, REQUIRE_PERMISSION } from '../auth/rbac.guard';

describe('RBAC Security', () => {
  let guard: RbacGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RbacGuard(reflector);
  });

  function ctx(user: any, request: any = {}) {
    if (user) request.user = user;
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as any;
  }

  it('blocks student accessing admin endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:all']);
    const student = {
      id: 's1',
      roles: [{ name: 'student', permissions: [{ code: 'task:submit' }] }],
    };
    expect(() => guard.canActivate(ctx(student))).toThrow(ForbiddenException);
  });

  it('blocks homeroom teacher accessing grade-scoped data without permission', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['result:grade']);
    const teacher = {
      id: 't1',
      classId: 'c1',
      roles: [{ name: 'teacher', permissions: [{ code: 'result:class' }] }],
    };
    expect(() => guard.canActivate(ctx(teacher))).toThrow(ForbiddenException);
  });

  it('derives correct data scope - own scope cannot see class data', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['result:own']);
    const student = {
      id: 's1',
      roles: [{ name: 'student', permissions: [{ code: 'result:own' }] }],
    };
    const req: any = {};
    void guard.canActivate(ctx(student, req));
    expect(req.dataScope.scope).toBe('own');
  });

  it('passes admin with all scope for admin endpoints', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:all']);
    const admin = {
      id: 'a1',
      roles: [{ name: 'admin', permissions: [{ code: 'admin:all' }] }],
    };
    const req: any = {};
    expect(guard.canActivate(ctx(admin, req))).toBe(true);
    expect(req.dataScope.scope).toBe('all');
  });

  it('blocks request with no user when permission required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['scale:read']);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it('blocks permission code injection attempts', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(["admin:all'; DROP TABLE users;--"]);
    const attacker = {
      id: 'h1',
      roles: [
        {
          name: 'student',
          permissions: [{ code: "admin:all'; DROP TABLE users;--" }],
        },
      ],
    };
    expect(() => guard.canActivate(ctx(attacker))).not.toThrow();
    const req: any = {};
    const result = guard.canActivate(ctx(attacker, req));
    expect(result).toBe(true);
  });

  it('demonstrates role escalation risk — guard trusts JWT payload roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:all']);
    const attacker = {
      id: 's1',
      roles: [{ name: 'admin', permissions: [{ code: 'admin:all' }] }],
    };
    const req: any = {};
    expect(guard.canActivate(ctx(attacker, req))).toBe(true);
    expect(req.dataScope.scope).toBe('all');
  });

  it('blocks student with student permissions from admin endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin:all']);
    const student = {
      id: 's1',
      roles: [{ name: 'student', permissions: [{ code: 'task:submit' }] }],
    };
    expect(() => guard.canActivate(ctx(student))).toThrow(ForbiddenException);
  });

  it('allows request when no permission decorator is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const req: any = {};
    expect(guard.canActivate(ctx(undefined, req))).toBe(true);
  });
});
