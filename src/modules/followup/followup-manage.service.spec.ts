/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowupManageService } from './followup-manage.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';
import { DataSource } from 'typeorm';
import { ConfigReloadService } from '../core/config-reload.service';

describe('FollowupManageService', () => {
  let service: FollowupManageService;

  const mockResultRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockAnswerRepo = { find: jest.fn() };
  const mockInterviewRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
  const mockStudentRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockClassRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockGradeRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };
  const mockEncryptionService = {
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };
  const mockConfigService = {
    get: jest.fn().mockReturnValue('yellow'),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowupManageService,
        { provide: getRepositoryToken(TaskResult), useValue: mockResultRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: mockAnswerRepo },
        { provide: getRepositoryToken(Interview), useValue: mockInterviewRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: ConfigReloadService, useValue: mockConfigService },
        { provide: DataSource, useValue: { query: jest.fn().mockImplementation((_sql: string, params: string[][]) => Promise.resolve((params?.[0] || []).map((id: string) => ({ id, studentId: id })))) } },
    }).compile();

    service = module.get<FollowupManageService>(FollowupManageService);
  });

  describe('getStudents', () => {
    const makeRiskQb = (rows: any[]) => ({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    const makeInterviewQb = (rows: any[]) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    it('should return empty when no risk students and no interviews', async () => {
      mockResultRepo.createQueryBuilder.mockReturnValue(makeRiskQb([]));
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb([]),
      );

      const result = await service.getStudents({ scope: 'all', userId: 'u1' });

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should aggregate risk students by yellow+red threshold', async () => {
      const riskRows = [
        { studentId: 's1', color: 'yellow', level: 'mild' },
        { studentId: 's2', color: 'red', level: 'severe' },
      ];
      mockResultRepo.createQueryBuilder.mockReturnValue(makeRiskQb(riskRows));
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb([]),
      );
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([
          ['s1', { name: 'A', studentNumber: '1' }],
          ['s2', { name: 'B', studentNumber: '2' }],
        ]),
      );
      mockStudentRepo.find.mockResolvedValue([
        { id: 's1', classId: 'c1' },
        { id: 's2', classId: 'c1' },
      ]);
      mockClassRepo.find.mockResolvedValue([
        { id: 'c1', name: 'C1', gradeId: 'g1' },
      ]);
      mockGradeRepo.find.mockResolvedValue([{ id: 'g1', name: 'G1' }]);

      const result = await service.getStudents({ scope: 'all', userId: 'u1' });

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
      const ids = result.data.map((d: any) => d.studentId).sort();
      expect(ids).toEqual(['s1', 's2']);
    });

    it('should aggregate interview students', async () => {
      mockResultRepo.createQueryBuilder.mockReturnValue(makeRiskQb([]));
      const interviewRows = [
        { studentId: 's1', cnt: '2', lastDate: '2024-02-01' },
      ];
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb(interviewRows),
      );
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: 'A', studentNumber: '1' }]]),
      );
      mockStudentRepo.find.mockResolvedValue([{ id: 's1', classId: 'c1' }]);
      mockClassRepo.find.mockResolvedValue([
        { id: 'c1', name: 'C1', gradeId: 'g1' },
      ]);
      mockGradeRepo.find.mockResolvedValue([{ id: 'g1', name: 'G1' }]);

      const result = await service.getStudents({ scope: 'all', userId: 'u1' });

      expect(result.total).toBe(1);
      expect(result.data[0].interviewCount).toBe(2);
    });

    it('should apply dataScope filter', async () => {
      const riskRows = [
        { studentId: 's1', color: 'yellow', level: 'mild' },
      ];
      mockResultRepo.createQueryBuilder.mockReturnValue(makeRiskQb(riskRows));
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb([]),
      );
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s2']);

      const result = await service.getStudents({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should paginate correctly', async () => {
      const riskRows = Array.from({ length: 30 }, (_, i) => ({
        studentId: `s${i}`,
        color: 'yellow',
        level: 'mild',
      }));
      mockResultRepo.createQueryBuilder.mockReturnValue(
        makeRiskQb(riskRows),
      );
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb([]),
      );
      const piiMap = new Map(
        Array.from({ length: 30 }, (_, i) => [
          `s${i}`,
          { name: `Student${i}`, studentNumber: `${i}` },
        ]),
      );
      mockEncryptionService.batchDecrypt.mockResolvedValue(piiMap);
      mockStudentRepo.find.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `s${10 + i}`,
          classId: 'c1',
        })),
      );
      mockClassRepo.find.mockResolvedValue([
        { id: 'c1', name: 'C1', gradeId: 'g1' },
      ]);
      mockGradeRepo.find.mockResolvedValue([{ id: 'g1', name: 'G1' }]);

      const result = await service.getStudents(
        { scope: 'all', userId: 'u1' },
        2,
        10,
      );

      expect(result.total).toBe(30);
      expect(result.data.length).toBe(10);
    });

    it('should use red-only threshold when config is red', async () => {
      mockConfigService.get.mockReturnValue('red');
      const riskRows = [
        { studentId: 's2', color: 'red', level: 'severe' },
      ];
      mockResultRepo.createQueryBuilder.mockReturnValue(makeRiskQb(riskRows));
      mockInterviewRepo.createQueryBuilder.mockReturnValue(
        makeInterviewQb([]),
      );
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s2', { name: 'B', studentNumber: '2' }]]),
      );
      mockStudentRepo.find.mockResolvedValue([{ id: 's2', classId: 'c1' }]);
      mockClassRepo.find.mockResolvedValue([
        { id: 'c1', name: 'C1', gradeId: 'g1' },
      ]);
      mockGradeRepo.find.mockResolvedValue([{ id: 'g1', name: 'G1' }]);

      const result = await service.getStudents({ scope: 'all', userId: 'u1' });

      expect(result.total).toBe(1);
      expect(result.data[0].studentId).toBe('s2');
    });
  });

  describe('getStudentDetail', () => {
    it('should return full student detail', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: 'Zhang', studentNumber: '001' }]]),
      );
      mockStudentRepo.findOne.mockResolvedValue({ id: 's1', classId: 'c1' });
      mockClassRepo.findOne.mockResolvedValue({
        id: 'c1',
        name: 'C1',
        gradeId: 'g1',
      });
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: 'G1' });
      mockInterviewRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);

      const result = await service.getStudentDetail('s1', {
        scope: 'all',
        userId: 'u1',
      });

      expect(result.studentName).toBe('Zhang');
      expect(result.className).toBe('C1');
      expect(result.gradeName).toBe('G1');
    });

    it('should throw ForbiddenException when dataScope denies', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s-other']);

      await expect(
        service.getStudentDetail('s1', {
          scope: 'class',
          userId: 'u1',
          classId: 'c1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when student not found', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockStudentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getStudentDetail('s1', { scope: 'all', userId: 'u1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getThreshold', () => {
    it('should return configured threshold', () => {
      mockConfigService.get.mockReturnValue('yellow');
      const result = service.getThreshold();
      expect(result).toEqual({ threshold: 'yellow' });
    });
  });

  describe('updateThreshold', () => {
    it('should update threshold and return oldValue', async () => {
      mockConfigService.get.mockReturnValue('yellow');

      const result = await service.updateThreshold('red', 'admin1');

      expect(mockConfigService.set).toHaveBeenCalledWith(
        'followup.risk_threshold',
        'red',
        'admin1',
      );
      expect(result).toEqual({ threshold: 'red', oldValue: 'yellow' });
    });
  });
});
