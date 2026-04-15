/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { of, throwError } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLog } from '../../entities/audit/audit-log.entity';

describe('Audit Security', () => {
  let interceptor: AuditInterceptor;
  let auditRepo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    auditRepo = {
      create: jest.fn((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();
    interceptor = module.get(AuditInterceptor);
  });

  function ctx(req: any) {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
  }

  function handler(observable$: any) {
    return { handle: () => observable$ } as any;
  }

  it('does not log password in audit entry', (done) => {
    const req = {
      user: { id: 'u1' },
      method: 'POST',
      url: '/api/auth/login',
      ip: '127.0.0.1',
      headers: {},
      body: { password: 'secret123' },
    };
    interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
      complete: () => {
        const logged = auditRepo.create.mock.calls[0][0];
        expect(JSON.stringify(logged)).not.toContain('secret123');
        expect(JSON.stringify(logged)).not.toContain('password');
        done();
      },
    });
  });

  it('records action with URL path and extracts resource info', (done) => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const req = {
      user: { id: 'u1' },
      method: 'GET',
      url: `/api/scales/${uuid}`,
      ip: '127.0.0.1',
      headers: {},
    };
    interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
      complete: () => {
        const logged = auditRepo.create.mock.calls[0][0];
        expect(logged.action).toBe(`GET /api/scales/${uuid}`);
        expect(logged.resourceType).toBe('scales');
        expect(logged.resourceId).toBe(uuid);
        done();
      },
    });
  });

  it('safely handles path traversal and injection payloads in URL', (done) => {
    const maliciousUrl = '/api/scales/../../../etc/passwd';
    const req = {
      user: { id: 'u1' },
      method: 'GET',
      url: maliciousUrl,
      ip: '127.0.0.1',
      headers: {},
    };
    interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
      complete: () => {
        const logged = auditRepo.create.mock.calls[0][0];
        expect(logged.action).toBe(`GET ${maliciousUrl}`);
        expect(logged.resourceId).toBeNull();
        expect(auditRepo.save).toHaveBeenCalledTimes(1);
        done();
      },
    });
  });

  it('does not throw when save fails (audit does not block request)', (done) => {
    auditRepo.save.mockRejectedValue(new Error('DB down'));
    const req = {
      user: { id: 'u1' },
      method: 'GET',
      url: '/api/scales',
      ip: '127.0.0.1',
      headers: {},
    };
    interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
      complete: () => done(),
      error: () => done.fail('Should not propagate save error'),
    });
  });

  it('does not write audit log for failed requests', (done) => {
    const req = {
      user: { id: 'u1' },
      method: 'POST',
      url: '/api/scales',
      ip: '127.0.0.1',
      headers: {},
    };
    interceptor
      .intercept(ctx(req), handler(throwError(() => new Error('fail'))))
      .subscribe({
        error: () => {
          expect(auditRepo.save).not.toHaveBeenCalled();
          done();
        },
      });
  });

  it('logs userId as null for unauthenticated requests', (done) => {
    const req = {
      method: 'POST',
      url: '/api/auth/login',
      ip: '10.0.0.1',
      headers: {},
    };
    interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
      complete: () => {
        const logged = auditRepo.create.mock.calls[0][0];
        expect(logged.userId).toBeNull();
        done();
      },
    });
  });

  it('handles concurrent audit writes without data loss', (done) => {
    const req = {
      user: { id: 'u1' },
      method: 'GET',
      url: '/api/scales',
      ip: '127.0.0.1',
      headers: {},
    };
    const concurrent = 5;
    let completed = 0;
    for (let i = 0; i < concurrent; i++) {
      interceptor.intercept(ctx(req), handler(of('ok'))).subscribe({
        complete: () => {
          completed++;
          if (completed === concurrent) {
            expect(auditRepo.save).toHaveBeenCalledTimes(concurrent);
            done();
          }
        },
      });
    }
  });
});
