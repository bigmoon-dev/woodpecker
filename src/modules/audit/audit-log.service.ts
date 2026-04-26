import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit/audit-log.entity';

export interface AuditLogEntry {
  operatorId: string;
  operatorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  ip?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLog> {
    const record = this.auditRepo.create({
      operatorId: entry.operatorId,
      operatorName: entry.operatorName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId || null,
      changes: entry.changes || null,
      ip: entry.ip || null,
    });
    return this.auditRepo.save(record);
  }

  async query(filters: {
    entityType?: string;
    entityId?: string;
    operatorId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filters.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }
    if (filters.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.operatorId) {
      qb.andWhere('log.operatorId = :operatorId', {
        operatorId: filters.operatorId,
      });
    }
    if (filters.action) {
      qb.andWhere('log.action LIKE :action', { action: `%${filters.action}%` });
    }
    if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }
}
