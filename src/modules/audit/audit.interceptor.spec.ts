/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { AuditInterceptor } from './audit.interceptor';
import { AuditIntegrityService } from './audit-integrity.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditRepo: any;

  const mockAuditRepo = {
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'AUDIT_HMAC_SECRET') return 'test-hmac-secret';
      return undefined;
    }),
  };

  const mockIntegrityService = {
    computeHash: jest.fn().mockReturnValue('fake-integrity-hash'),
  };

  const mockExecutionContext = (req: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => req }),
  });

  const mockCallHandler = {
    handle: jest.fn(() => of(undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIntegrityService.computeHash.mockReturnValue('fake-integrity-hash');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditIntegrityService, useValue: mockIntegrityService },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should create and save audit log on successful request', (done) => {
    const req = {
      user: { id: 'user-123', displayName: 'Admin' },
      method: 'POST',
      url: '/api/admin/scales/12345678-1234-1234-1234-123456789abc',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest' },
    };
    mockAuditRepo.save.mockResolvedValueOnce({ id: 'log-1' });

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              operatorId: 'user-123',
              operatorName: 'Admin',
              action:
                'POST /api/admin/scales/12345678-1234-1234-1234-123456789abc',
              entityType: 'admin',
              entityId: '12345678-1234-1234-1234-123456789abc',
              ip: '127.0.0.1',
              userAgent: 'Jest',
            }),
          );
          expect(auditRepo.save).toHaveBeenCalled();
          done();
        },
      });
  });

  it('should handle request without user (null operatorId)', (done) => {
    const req = {
      method: 'GET',
      url: '/api/auth/login',
      ip: '::1',
      headers: {},
    };
    mockAuditRepo.save.mockResolvedValueOnce({});

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              operatorId: null,
              operatorName: 'anonymous',
              action: 'GET /api/auth/login',
              entityType: 'auth',
              entityId: null,
            }),
          );
          done();
        },
      });
  });

  it('should extract resource as second path segment', (done) => {
    const req = {
      method: 'DELETE',
      url: '/api/org/classes/abc',
      ip: '10.0.0.1',
      headers: {},
    };
    mockAuditRepo.save.mockResolvedValueOnce({});

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              entityType: 'org',
            }),
          );
          done();
        },
      });
  });

  it('should return unknown resource for short URLs', (done) => {
    const req = {
      method: 'GET',
      url: '/',
      ip: '127.0.0.1',
      headers: {},
    };
    mockAuditRepo.save.mockResolvedValueOnce({});

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              entityType: 'unknown',
            }),
          );
          done();
        },
      });
  });

  it('should extract UUID from URL as entityId', (done) => {
    const uuid = '12345678-1234-1234-1234-123456789abc';
    const req = {
      method: 'PUT',
      url: `/api/scales/${uuid}`,
      ip: '127.0.0.1',
      headers: {},
    };
    mockAuditRepo.save.mockResolvedValueOnce({});

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              entityId: uuid,
            }),
          );
          done();
        },
      });
  });

  it('should return null entityId when URL has no UUID', (done) => {
    const req = {
      method: 'GET',
      url: '/api/admin/users',
      ip: '127.0.0.1',
      headers: {},
    };
    mockAuditRepo.save.mockResolvedValueOnce({});

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
              entityId: null,
            }),
          );
          done();
        },
      });
  });

  it('should swallow save errors gracefully', (done) => {
    const req = {
      user: { id: 'u1', displayName: 'Test' },
      method: 'POST',
      url: '/api/test',
      ip: '127.0.0.1',
      headers: {},
    };
    mockAuditRepo.save.mockRejectedValueOnce(new Error('DB error'));

    interceptor
      .intercept(mockExecutionContext(req) as any, mockCallHandler as any)
      .subscribe({
        complete: () => {
          expect(auditRepo.save).toHaveBeenCalled();
          done();
        },
        error: () => {
          fail('Should not propagate save error');
        },
      });
  });

  it('should throw when AUDIT_HMAC_SECRET is not set (undefined)', async () => {
    const undefinedMockConfig = {
      get: jest.fn().mockReturnValue(undefined),
    };
    await expect(
      Test.createTestingModule({
        providers: [
          AuditInterceptor,
          { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
          { provide: ConfigService, useValue: undefinedMockConfig },
          { provide: AuditIntegrityService, useValue: mockIntegrityService },
        ],
      }).compile(),
    ).rejects.toThrow('AUDIT_HMAC_SECRET');
  });

  it('should throw when AUDIT_HMAC_SECRET is empty string', async () => {
    const emptyMockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'AUDIT_HMAC_SECRET') return '';
        return undefined;
      }),
    };
    await expect(
      Test.createTestingModule({
        providers: [
          AuditInterceptor,
          { provide: getRepositoryToken(AuditLog), useValue: mockAuditRepo },
          { provide: ConfigService, useValue: emptyMockConfig },
          { provide: AuditIntegrityService, useValue: mockIntegrityService },
        ],
      }).compile(),
    ).rejects.toThrow('AUDIT_HMAC_SECRET');
  });
});
