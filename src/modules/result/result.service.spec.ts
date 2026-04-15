/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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
  let dataScopeFilter: any;

  const mockResultRepo = { find: jest.fn() };
  const mockAnswerRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
  const mockStudentRepo = { find: jest.fn() };
  const mockClassRepo = { find: jest.fn() };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };
  const mockEncryptionService = {
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };

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
    dataScopeFilter = module.get(DataScopeFilter);
    studentRepo = module.get(getRepositoryToken(Student));
    classRepo = module.get(getRepositoryToken(Class));
    encryptionService = module.get(EncryptionService);
  });

  describe('findByStudent', () => {
    it('should return results by studentId', async () => {
      const answers = [{ id: 'a1' }, { id: 'a2' }];
      const results = [{ id: 'r1' }, { id: 'r2' }];
      mockAnswerRepo.find.mockResolvedValue(answers);
      mockResultRepo.find.mockResolvedValue(results);

      const actual = await service.findByStudent('student1');

      expect(answerRepo.find).toHaveBeenCalledWith({
        where: { studentId: 'student1' },
      });
      expect(resultRepo.find).toHaveBeenCalledWith({
        where: [{ answerId: 'a1' }, { answerId: 'a2' }],
      });
      expect(actual).toEqual(results);
    });

    it('should return empty array when no answers found', async () => {
      mockAnswerRepo.find.mockResolvedValue([]);
      const actual = await service.findByStudent('student1');
      expect(actual).toEqual([]);
      expect(resultRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findByScope', () => {
    it('should return all results when scope=all', async () => {
      const results = [{ id: 'r1' }];
      mockResultRepo.find.mockResolvedValue(results);
      const actual = await service.findByScope({ scope: 'all', userId: 'u1' });
      expect(resultRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(actual).toEqual(results);
    });

    it('should filter by dataScope when scope is not all', async () => {
      const dataScope = {
        scope: 'class' as const,
        userId: 'u1',
        classId: 'c1',
      };
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'a1' }]);
      mockResultRepo.find.mockResolvedValue([{ id: 'r1' }]);

      const actual = await service.findByScope(dataScope);

      expect(dataScopeFilter.getStudentIds).toHaveBeenCalledWith(dataScope);
      expect(actual).toEqual([{ id: 'r1' }]);
    });

    it('should return empty array when no students in scope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue([]);
      const actual = await service.findByScope({
        scope: 'class' as const,
        userId: 'u1',
      });
      expect(actual).toEqual([]);
    });
  });

  describe('findByClass', () => {
    it('should return empty when no students', async () => {
      mockStudentRepo.find.mockResolvedValue([]);
      const result = await service.findByClass('c1');
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findByGrade', () => {
    it('should return empty when no classes', async () => {
      mockClassRepo.find.mockResolvedValue([]);
      const result = await service.findByGrade('g1');
      expect(result).toEqual({ data: [], total: 0 });
    });
  });
});
