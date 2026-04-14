/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResultService } from './result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';

describe('ResultService', () => {
  let service: ResultService;
  let resultRepo: any;
  let answerRepo: any;
  let studentRepo: any;
  let classRepo: any;
  let dataScopeFilter: any;
  let encryptionService: any;

  const mockResultRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const mockAnswerRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockStudentRepo = { find: jest.fn() };
  const mockClassRepo = { find: jest.fn() };
  const mockDataScopeFilter = { getStudentIds: jest.fn() };
  const mockEncryptionService = { batchDecrypt: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultService,
        { provide: getRepositoryToken(TaskResult), useValue: mockResultRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: mockAnswerRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<ResultService>(ResultService);
    resultRepo = module.get(getRepositoryToken(TaskResult));
    answerRepo = module.get(getRepositoryToken(TaskAnswer));
    studentRepo = module.get(getRepositoryToken(Student));
    classRepo = module.get(getRepositoryToken(Class));
    dataScopeFilter = module.get(DataScopeFilter);
    encryptionService = module.get(EncryptionService);
  });

  describe('findByStudent', () => {
    it('should return results for a student via answers', async () => {
      mockAnswerRepo.find.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
      mockResultRepo.find.mockResolvedValue([
        { id: 'r1', answerId: 'a1' },
        { id: 'r2', answerId: 'a2' },
      ]);
      const results = await service.findByStudent('s1');
      expect(results).toHaveLength(2);
      expect(mockAnswerRepo.find).toHaveBeenCalledWith({
        where: { studentId: 's1' },
      });
    });

    it('should return empty array when no answers', async () => {
      mockAnswerRepo.find.mockResolvedValue([]);
      const results = await service.findByStudent('s1');
      expect(results).toEqual([]);
    });
  });

  describe('findByScope', () => {
    it('should return all results for scope=all', async () => {
      mockResultRepo.find.mockResolvedValue([{ id: 'r1' }]);
      const results = await service.findByScope({
        scope: 'all',
        userId: 'u1',
      });
      expect(results).toHaveLength(1);
      expect(mockResultRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter by studentIds for non-all scope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1', 's2']);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'a1', studentId: 's1' }]);
      mockResultRepo.find.mockResolvedValue([{ id: 'r1' }]);
      const results = await service.findByScope({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(results).toHaveLength(1);
      expect(dataScopeFilter.getStudentIds).toHaveBeenCalled();
    });

    it('should return empty array when no studentIds', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue([]);
      const results = await service.findByScope({
        scope: 'class',
        userId: 'u1',
      });
      expect(results).toEqual([]);
    });
  });

  describe('findByClass', () => {
    it('should return paginated results with context', async () => {
      mockStudentRepo.find.mockResolvedValue([{ id: 's1' }]);
      mockAnswerRepo.find.mockResolvedValue([
        { id: 'a1', studentId: 's1', task: { title: 'Task1' } },
      ]);
      mockResultRepo.find.mockResolvedValue([
        { id: 'r1', answerId: 'a1', createdAt: new Date() },
      ]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: 'Alice', studentNumber: '001' }]]),
      );
      const result = await service.findByClass('c1', 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].studentName).toBe('Alice');
    });
  });

  describe('findByGrade', () => {
    it('should resolve classes then students then results', async () => {
      mockClassRepo.find.mockResolvedValue([{ id: 'c1' }]);
      mockStudentRepo.find.mockResolvedValue([{ id: 's1' }]);
      mockAnswerRepo.find.mockResolvedValue([
        { id: 'a1', studentId: 's1', task: { title: 'T' } },
      ]);
      mockResultRepo.find.mockResolvedValue([
        { id: 'r1', answerId: 'a1', createdAt: new Date() },
      ]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      const result = await service.findByGrade('g1', 1, 20);
      expect(result.data).toHaveLength(1);
    });

    it('should return empty when no classes in grade', async () => {
      mockClassRepo.find.mockResolvedValue([]);
      const result = await service.findByGrade('g1');
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findByFilter', () => {
    it('should filter by taskId with scope=all', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'a1', studentId: 's1', task: { title: 'T' } },
          ]),
      };
      mockAnswerRepo.createQueryBuilder.mockReturnValue(qb);
      mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());

      const results = await service.findByFilter({
        taskId: 't1',
        dataScope: { scope: 'all', userId: 'u1' },
      });
      expect(results).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledWith('ta.task_id = :taskId', {
        taskId: 't1',
      });
    });

    it('should filter by classId', async () => {
      mockStudentRepo.find.mockResolvedValue([{ id: 's1' }]);
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'a1', studentId: 's1', task: { title: 'T' } },
          ]),
      };
      mockAnswerRepo.createQueryBuilder.mockReturnValue(qb);
      mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: 'Bob', studentNumber: '002' }]]),
      );
      const results = await service.findByFilter({
        classId: 'c1',
        dataScope: { scope: 'all', userId: 'u1' },
      });
      expect(results[0].studentName).toBe('Bob');
    });

    it('should return empty when no submitted answers', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockAnswerRepo.createQueryBuilder.mockReturnValue(qb);
      const results = await service.findByFilter({
        dataScope: { scope: 'all', userId: 'u1' },
      });
      expect(results).toEqual([]);
    });

    it('should filter by gradeId resolving classes and students', async () => {
      mockClassRepo.find.mockResolvedValue([{ id: 'c1' }]);
      mockStudentRepo.find.mockResolvedValue([{ id: 's1' }]);
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'a1', studentId: 's1', task: { title: 'T' } },
          ]),
      };
      mockAnswerRepo.createQueryBuilder.mockReturnValue(qb);
      mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      const results = await service.findByFilter({
        gradeId: 'g1',
        dataScope: { scope: 'all', userId: 'u1' },
      });
      expect(results).toHaveLength(1);
    });
  });
});
