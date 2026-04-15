/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { AuditIntegrityService } from './audit-integrity.service';
import * as crypto from 'crypto';

describe('AuditIntegrityService', () => {
  let service: AuditIntegrityService;
  const secret = 'test-hmac-secret-key';

  beforeEach(() => {
    service = new AuditIntegrityService();
  });

  describe('computeHash', () => {
    it('produces consistent HMAC-SHA256 for a complete log entry', () => {
      const log = {
        userId: 'u1',
        action: 'POST /api/scales',
        resourceType: 'scales',
        resourceId: 'r1',
        ip: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date('2025-01-15T10:00:00Z'),
      };
      const hash = service.computeHash(log, secret);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      const hash2 = service.computeHash(log, secret);
      expect(hash2).toBe(hash);
    });

    it('handles all null/undefined fields by defaulting to empty strings', () => {
      const log = {
        userId: undefined,
        action: undefined,
        resourceType: undefined,
        resourceId: undefined,
        ip: undefined,
        userAgent: undefined,
        createdAt: undefined,
      };
      const hash = service.computeHash(log, secret);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      const expectedPayload = '||||||';
      const manualHash = crypto
        .createHmac('sha256', secret)
        .update(expectedPayload)
        .digest('hex');
      expect(hash).toBe(manualHash);
    });

    it('handles null createdAt by using empty string in payload', () => {
      const log = {
        userId: 'u1',
        action: 'GET /api/test',
        resourceType: 'test',
        resourceId: null,
        ip: '10.0.0.1',
        userAgent: 'Test',
        createdAt: null as unknown as undefined,
      };
      const hash = service.computeHash(log as any, secret);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('converts valid createdAt to ISO string', () => {
      const date = new Date('2025-06-01T12:00:00Z');
      const log = {
        userId: 'u1',
        action: 'POST /api/test',
        resourceType: 'test',
        resourceId: null,
        ip: '10.0.0.1',
        userAgent: 'Test',
        createdAt: date,
      };
      const hash = service.computeHash(log, secret);

      const expectedPayload = [
        'u1',
        'POST /api/test',
        'test',
        '',
        '10.0.0.1',
        'Test',
        date.toISOString(),
      ].join('|');
      const manualHash = crypto
        .createHmac('sha256', secret)
        .update(expectedPayload)
        .digest('hex');
      expect(hash).toBe(manualHash);
    });
  });

  describe('verify', () => {
    it('returns false when integrityHash is null', () => {
      const log = {
        integrityHash: null,
        userId: 'u1',
        action: 'POST',
        resourceType: 'test',
        resourceId: null,
        ip: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date(),
      } as any;
      expect(service.verify(log, secret)).toBe(false);
    });

    it('returns false when hash length differs (tampered)', () => {
      const log = {
        userId: 'u1',
        action: 'POST',
        resourceType: 'test',
        resourceId: null,
        ip: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date(),
      };
      const hash = service.computeHash(log, secret);
      const logWithHash = {
        ...log,
        integrityHash: hash.slice(0, 32),
      } as any;
      expect(service.verify(logWithHash, secret)).toBe(false);
    });

    it('returns true for a valid matching hash', () => {
      const log = {
        userId: 'u1',
        action: 'POST /api/scales',
        resourceType: 'scales',
        resourceId: 'r1',
        ip: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date('2025-01-15T10:00:00Z'),
      };
      const hash = service.computeHash(log, secret);
      const logWithHash = { ...log, integrityHash: hash } as any;
      expect(service.verify(logWithHash, secret)).toBe(true);
    });

    it('returns false for a wrong secret', () => {
      const log = {
        userId: 'u1',
        action: 'POST',
        resourceType: 'test',
        resourceId: null,
        ip: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date(),
      };
      const hash = service.computeHash(log, secret);
      const logWithHash = { ...log, integrityHash: hash } as any;
      expect(service.verify(logWithHash, 'wrong-secret')).toBe(false);
    });
  });

  describe('verifyChain', () => {
    it('returns valid:true for empty array', () => {
      expect(service.verifyChain([], secret)).toEqual({ valid: true });
    });

    it('returns valid:true when all logs are untampered', () => {
      const logs = [1, 2, 3].map((i) => {
        const base = {
          userId: `u${i}`,
          action: `POST /api/${i}`,
          resourceType: 'test',
          resourceId: null,
          ip: '127.0.0.1',
          userAgent: 'Jest',
          createdAt: new Date(2025, 0, i),
        };
        return { ...base, integrityHash: service.computeHash(base, secret) };
      });
      expect(service.verifyChain(logs as any[], secret)).toEqual({
        valid: true,
      });
    });

    it('detects tampered entry at specific index after sorting', () => {
      const entries = [
        { date: new Date(2025, 0, 1), userId: 'u1' },
        { date: new Date(2025, 0, 2), userId: 'u2' },
        { date: new Date(2025, 0, 3), userId: 'u3' },
      ];
      const logs = entries.map((e) => {
        const base = {
          userId: e.userId,
          action: `POST /api/${e.userId}`,
          resourceType: 'test',
          resourceId: null,
          ip: '127.0.0.1',
          userAgent: 'Jest',
          createdAt: e.date,
        };
        return { ...base, integrityHash: service.computeHash(base, secret) };
      });
      logs[1].action = 'TAMPERED ACTION';
      const result = service.verifyChain(logs as any[], secret);
      expect(result.valid).toBe(false);
      expect(result.tamperedIndex).toBe(1);
    });

    it('sorts by createdAt before verifying (unordered input)', () => {
      const dates = [
        new Date(2025, 0, 3),
        new Date(2025, 0, 1),
        new Date(2025, 0, 2),
      ];
      const logs = dates.map((d, i) => {
        const base = {
          userId: `u${i}`,
          action: `POST /api/${i}`,
          resourceType: 'test',
          resourceId: null,
          ip: '127.0.0.1',
          userAgent: 'Jest',
          createdAt: d,
        };
        return { ...base, integrityHash: service.computeHash(base, secret) };
      });
      expect(service.verifyChain(logs as any[], secret)).toEqual({
        valid: true,
      });
    });
  });
});
