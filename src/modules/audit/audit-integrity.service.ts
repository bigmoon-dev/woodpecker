import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditLog } from '../../entities/audit/audit-log.entity';

@Injectable()
export class AuditIntegrityService {
  computeHash(log: Partial<AuditLog>, secret: string): string {
    const payload = [
      log.operatorId ?? '',
      log.action ?? '',
      log.entityType ?? '',
      log.entityId ?? '',
      log.ip ?? '',
      log.userAgent ?? '',
      log.createdAt ? new Date(log.createdAt).toISOString() : '',
    ].join('|');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  verify(log: AuditLog, secret: string): boolean {
    if (!log.integrityHash) return false;
    const expected = this.computeHash(log, secret);
    const a = Buffer.from(log.integrityHash, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  verifyChain(
    logs: AuditLog[],
    secret: string,
  ): { valid: boolean; tamperedIndex?: number } {
    const sorted = [...logs].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (let i = 0; i < sorted.length; i++) {
      if (!this.verify(sorted[i], secret)) {
        return { valid: false, tamperedIndex: i };
      }
    }
    return { valid: true };
  }
}
