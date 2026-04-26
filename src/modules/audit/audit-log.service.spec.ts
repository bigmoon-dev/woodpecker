/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit/audit-log.entity';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let auditRepo: any;

  const mockAuditRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditRepo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      const entry = {
        operatorId: 'user-1',
        operatorName: 'Admin',
        action: 'student.update_status',
        entityType: 'student',
        entityId: 'student-1',
        changes: { status: { before: 'active', after: 'suspended' } },
        ip: '127.0.0.1',
      };
      mockAuditRepo.save.mockResolvedValueOnce({ id: 'log-1', ...entry });

      const result = await service.log(entry);

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          operatorId: 'user-1',
          operatorName: 'Admin',
          action: 'student.update_status',
          entityType: 'student',
          entityId: 'student-1',
          changes: { status: { before: 'active', after: 'suspended' } },
          ip: '127.0.0.1',
        }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
      expect(result.operatorId).toBe('user-1');
    });

    it('should handle entry without optional fields', async () => {
      const entry = {
        operatorId: 'user-2',
        operatorName: 'Teacher',
        action: 'interview.create',
        entityType: 'interview',
      };
      mockAuditRepo.save.mockResolvedValueOnce({ id: 'log-2', ...entry });

      const result = await service.log(entry);

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: undefined,
          changes: undefined,
          ip: undefined,
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('query', () => {
    function mockQueryBuilder() {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(),
      };
      return qb;
    }

    it('should return paginated audit logs', async () => {
      const qb = mockQueryBuilder();
      const logs = [
        { id: 'l1', action: 'test' },
        { id: 'l2', action: 'test2' },
      ];
      qb.getManyAndCount.mockResolvedValueOnce([logs, 2]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.query({ page: 1, limit: 10 });

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(2);
      expect(qb.orderBy).toHaveBeenCalledWith('log.createdAt', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('should apply entityType filter', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ entityType: 'student' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.entityType = :entityType', {
        entityType: 'student',
      });
    });

    it('should apply entityId filter', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ entityId: 'e1' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.entityId = :entityId', {
        entityId: 'e1',
      });
    });

    it('should apply operatorId filter', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ operatorId: 'op1' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.operatorId = :operatorId', {
        operatorId: 'op1',
      });
    });

    it('should apply action filter with LIKE', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ action: 'student' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.action LIKE :action', {
        action: '%student%',
      });
    });

    it('should apply date range filters', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');

      await service.query({ startDate: start, endDate: end });

      expect(qb.andWhere).toHaveBeenCalledWith('log.createdAt >= :startDate', {
        startDate: start,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('log.createdAt <= :endDate', {
        endDate: end,
      });
    });

    it('should use default page=1 and limit=50', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('should cap limit at 200', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(200);
    });

    it('should calculate correct offset for page > 1', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      auditRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.query({ page: 3, limit: 20 });

      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });
});
