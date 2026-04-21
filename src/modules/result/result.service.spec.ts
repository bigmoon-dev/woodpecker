/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResultService } from './result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';
import { DataSource } from 'typeorm';

describe('ResultService', () => {
  let service: ResultService;
  let resultRepo: any;
  let answerRepo: any;
  let dataScopeFilter: any;

  const mockResultRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockAnswerRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const mockStudentRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockClassRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockGradeRepo = { find: jest.fn(), findOne: jest.fn() };
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
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
        { provide: EncryptionService, useValue: mockEncryptionService },
        {
          provide: DataSource,
          useValue: {
            query: jest
              .fn()
              .mockImplementation((_sql: string, params: string[][]) =>
                Promise.resolve(
                  (params?.[0] || []).map((id: string) => ({
                    id,
                    studentId: id,
                  })),
                ),
              ),
          },
        },
      ],
    }).compile();

    service = module.get<ResultService>(ResultService);
    resultRepo = module.get(getRepositoryToken(TaskResult));
    answerRepo = module.get(getRepositoryToken(TaskAnswer));
    dataScopeFilter = module.get(DataScopeFilter);
  });

  describe('findByStudent', () => {
    it('should return results with context by studentId', async () => {
      const answers = [
        { id: 'a1', task: { title: 'T1', scale: { name: 'S1' } } },
        { id: 'a2', task: { title: 'T2', scale: { name: 'S2' } } },
      ];
      const results = [
        { id: 'r1', answerId: 'a1' },
        { id: 'r2', answerId: 'a2' },
      ];
      mockAnswerRepo.find.mockResolvedValue(answers);
      mockResultRepo.find.mockResolvedValue(results);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['student1', { name: 'Zhang', studentNumber: '001' }]]),
      );
      mockStudentRepo.findOne.mockResolvedValue({
        id: 'student1',
        classId: 'c1',
      });
      mockClassRepo.findOne.mockResolvedValue({
        id: 'c1',
        name: 'C1',
        gradeId: 'g1',
      });
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: 'G1' });

      const actual = await service.findByStudent('student1');

      expect(answerRepo.find).toHaveBeenCalledWith({
        where: { studentId: 'student1' },
        relations: ['task', 'task.scale'],
      });
      expect(actual.length).toBe(2);
      expect(actual[0].studentName).toBe('Zhang');
      expect(actual[0].className).toBe('C1');
      expect(actual[0].scaleName).toBe('S1');
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

  describe('findOne', () => {
    it('should return ResultDetail with student info', async () => {
      const result = {
        id: 'r1',
        answerId: 'a1',
        totalScore: 80,
        level: 'normal',
        color: 'green',
      };
      const answer = {
        id: 'a1',
        studentId: 's1',
        task: { title: 'Task1', scale: { name: 'Scale1' } },
      };
      const student = { id: 's1', classId: 'c1' };
      const cls = { id: 'c1', name: 'Class1', gradeId: 'g1' };
      const grade = { id: 'g1', name: 'Grade1' };
      const piiMap = new Map([
        ['s1', { name: 'Zhang San', studentNumber: '2024001' }],
      ]);

      mockResultRepo.findOne.mockResolvedValue(result);
      mockAnswerRepo.findOne.mockResolvedValue(answer);
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockEncryptionService.batchDecrypt.mockResolvedValue(piiMap);
      mockStudentRepo.findOne.mockResolvedValue(student);
      mockClassRepo.findOne.mockResolvedValue(cls);
      mockGradeRepo.findOne.mockResolvedValue(grade);

      const actual = await service.findOne('r1', {
        scope: 'all',
        userId: 'u1',
      });

      expect(actual.result).toEqual(result);
      expect(actual.studentName).toBe('Zhang San');
      expect(actual.studentNumber).toBe('2024001');
      expect(actual.className).toBe('Class1');
      expect(actual.gradeName).toBe('Grade1');
      expect(actual.taskTitle).toBe('Task1');
      expect(actual.scaleName).toBe('Scale1');
    });

    it('should throw NotFoundException when result not found', async () => {
      mockResultRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('missing', { scope: 'all', userId: 'u1' }),
      ).rejects.toThrow('Result missing not found');
    });

    it('should throw NotFoundException when answer not found', async () => {
      mockResultRepo.findOne.mockResolvedValue({ id: 'r1', answerId: 'a1' });
      mockAnswerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('r1', { scope: 'all', userId: 'u1' }),
      ).rejects.toThrow('Answer for result r1 not found');
    });

    it('should throw ForbiddenException when dataScope denies access', async () => {
      mockResultRepo.findOne.mockResolvedValue({ id: 'r1', answerId: 'a1' });
      mockAnswerRepo.findOne.mockResolvedValue({
        id: 'a1',
        studentId: 's-outside',
      });
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1', 's2']);

      await expect(
        service.findOne('r1', { scope: 'class', userId: 'u1', classId: 'c1' }),
      ).rejects.toThrow('You do not have access to this result');
    });

    it('should allow access when dataScope.scope is all', async () => {
      const result = { id: 'r1', answerId: 'a1' };
      const answer = {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T', scale: { name: 'S' } },
      };
      mockResultRepo.findOne.mockResolvedValue(result);
      mockAnswerRepo.findOne.mockResolvedValue(answer);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      mockStudentRepo.findOne.mockResolvedValue(null);

      const actual = await service.findOne('r1', {
        scope: 'all',
        userId: 'u1',
      });

      expect(dataScopeFilter.getStudentIds).not.toHaveBeenCalled();
      expect(actual.result).toEqual(result);
    });

    it('should decrypt PII for student name and number', async () => {
      const result = { id: 'r1', answerId: 'a1' };
      const answer = {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T', scale: { name: 'S' } },
      };
      const piiMap = new Map([
        ['s1', { name: 'Li Si', studentNumber: 'SN001' }],
      ]);
      mockResultRepo.findOne.mockResolvedValue(result);
      mockAnswerRepo.findOne.mockResolvedValue(answer);
      mockEncryptionService.batchDecrypt.mockResolvedValue(piiMap);
      mockStudentRepo.findOne.mockResolvedValue(null);

      const actual = await service.findOne('r1', {
        scope: 'all',
        userId: 'u1',
      });

      expect(mockEncryptionService.batchDecrypt).toHaveBeenCalledWith(['s1']);
      expect(actual.studentName).toBe('Li Si');
      expect(actual.studentNumber).toBe('SN001');
    });

    it('should handle missing student/class/grade gracefully', async () => {
      const result = { id: 'r1', answerId: 'a1' };
      const answer = {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T', scale: { name: 'S' } },
      };
      mockResultRepo.findOne.mockResolvedValue(result);
      mockAnswerRepo.findOne.mockResolvedValue(answer);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      mockStudentRepo.findOne.mockResolvedValue(null);

      const actual = await service.findOne('r1', {
        scope: 'all',
        userId: 'u1',
      });

      expect(actual.studentName).toBe('');
      expect(actual.studentNumber).toBe('');
      expect(actual.className).toBe('');
      expect(actual.gradeName).toBe('');
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
