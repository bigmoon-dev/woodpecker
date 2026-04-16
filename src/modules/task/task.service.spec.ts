/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { Student } from '../../entities/org/student.entity';
import { DataSource } from 'typeorm';
import { ScoringEngine } from '../scoring/scoring.engine';
import { ScaleService } from '../scale/scale.service';
import { HookBus } from '../plugin/hook-bus';
import { AlertService } from '../alert/alert.service';

describe('TaskService', () => {
  let service: TaskService;
  let hookBus: any;
  let taskRepo: any;
  let answerRepo: any;
  let answerItemRepo: any;
  let resultRepo: any;
  let scoringEngine: any;
  let scaleService: any;
  let studentRepo: any;
  let dataSource: any;

  const mockTaskRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 't1' })),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockAnswerRepo = {
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const mockAnswerItemRepo = {
    delete: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const mockResultRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'r1' })),
  };
  const mockStudentRepo = { findOne: jest.fn() };
  const mockScoringEngine = { calculate: jest.fn() };
  const mockScaleService = { findOne: jest.fn() };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockDataSource)),
    getRepository: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((_: any, d: any) => d),
    save: jest.fn((d: any) => Promise.resolve(d)),
    delete: jest.fn(),
  };

  const setupSubmitAnswers = (color: string) => {
    mockDataSource.findOne
      .mockResolvedValueOnce({ id: 't1', scaleId: 's1', status: 'published' })
      .mockResolvedValueOnce(null);
    mockDataSource.create.mockImplementation((_: any, d: any) => d);
    mockDataSource.save.mockImplementation((d: any) =>
      Promise.resolve({ ...d, id: d.id || 'a1' }),
    );
    mockDataSource.delete.mockResolvedValue(undefined);
    mockScaleService.findOne.mockResolvedValue({
      id: 's1',
      items: [
        {
          id: 'i1',
          dimension: null,
          reverseScore: false,
          options: [{ id: 'o1', scoreValue: 1 }],
        },
      ],
      scoringRules: [],
      scoreRanges: [],
    });
    mockScoringEngine.calculate.mockReturnValue({
      totalScore: 1,
      dimensionScores: {},
      level: color === 'green' ? 'normal' : 'abnormal',
      color,
      suggestion: '',
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDataSource.findOne.mockReset();
    mockDataSource.save.mockReset();
    mockDataSource.create.mockReset();
    mockDataSource.delete.mockReset();
    mockDataSource.transaction.mockReset();
    mockDataSource.transaction.mockImplementation((cb: any) => cb(mockDataSource));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: mockTaskRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: mockAnswerRepo },
        {
          provide: getRepositoryToken(TaskAnswerItem),
          useValue: mockAnswerItemRepo,
        },
        { provide: getRepositoryToken(TaskResult), useValue: mockResultRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: ScoringEngine, useValue: mockScoringEngine },
        { provide: ScaleService, useValue: mockScaleService },
        { provide: HookBus, useValue: mockHookBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    hookBus = module.get(HookBus);
    taskRepo = module.get(getRepositoryToken(Task));
    answerRepo = module.get(getRepositoryToken(TaskAnswer));
    answerItemRepo = module.get(getRepositoryToken(TaskAnswerItem));
    resultRepo = module.get(getRepositoryToken(TaskResult));
    scoringEngine = module.get(ScoringEngine);
    scaleService = module.get(ScaleService);

    // Override dataSource injection
    (service as any).dataSource = mockDataSource;
  });

  describe('create hook', () => {
    it('should emit on:task.created after create', async () => {
      mockTaskRepo.save.mockResolvedValueOnce({
        id: 't1',
        scaleId: 's1',
        createdById: 'u1',
      });
      await service.create({ scaleId: 's1', createdById: 'u1' });
      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:task.created',
        expect.objectContaining({
          taskId: 't1',
          scaleId: 's1',
          createdBy: 'u1',
        }),
      );
    });

    it('should not throw when on:task.created hook emit fails', async () => {
      mockTaskRepo.save.mockResolvedValueOnce({
        id: 't1',
        scaleId: 's1',
        createdById: 'u1',
      });
      mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));
      await expect(
        service.create({ scaleId: 's1', createdById: 'u1' }),
      ).resolves.toBeDefined();
    });
  });

  describe('submitAnswers', () => {
    it('should emit on:assessment.submitted after submitAnswers', async () => {
      setupSubmitAnswers('green');
      await service.submitAnswers('t1', 'student1', [
        { itemId: 'i1', optionId: 'o1' },
      ]);
      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:assessment.submitted',
        expect.objectContaining({
          taskId: 't1',
          studentId: 'student1',
          resultId: expect.any(String),
        }),
      );
    });

    it('should reject submission for non-published tasks', async () => {
      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        const m = {
          findOne: jest.fn().mockResolvedValue({ id: 't1', scaleId: 's1', status: 'draft' }),
          create: jest.fn((_, d) => d),
          save: jest.fn((d) => Promise.resolve(d)),
          delete: jest.fn(),
        };
        return cb(m);
      });
      await expect(
        service.submitAnswers('t1', 'student1', [{ itemId: 'i1', optionId: 'o1' }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate submission', async () => {
      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        const m = {
          findOne: jest.fn()
            .mockResolvedValueOnce({ id: 't1', scaleId: 's1', status: 'published' })
            .mockResolvedValueOnce({ id: 'a1', taskId: 't1', studentId: 'student1', status: 'submitted' }),
          create: jest.fn((_, d) => d),
          save: jest.fn((d) => Promise.resolve(d)),
          delete: jest.fn(),
        };
        return cb(m);
      });
      await expect(
        service.submitAnswers('t1', 'student1', [{ itemId: 'i1', optionId: 'o1' }]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('alert triggering', () => {
    it('should trigger alert when result color is red', async () => {
      setupSubmitAnswers('red');
      const mockAlertService = {
        triggerAlert: jest.fn().mockResolvedValue(undefined),
      };
      service.setAlertService(mockAlertService as any);
      await service.submitAnswers('t1', 'student1', [
        { itemId: 'i1', optionId: 'o1' },
      ]);
      expect(mockAlertService.triggerAlert).toHaveBeenCalled();
    });

    it('should not trigger alert when result color is green', async () => {
      setupSubmitAnswers('green');
      const mockAlertService = { triggerAlert: jest.fn() };
      service.setAlertService(mockAlertService as any);
      await service.submitAnswers('t1', 'student1', [
        { itemId: 'i1', optionId: 'o1' },
      ]);
      expect(mockAlertService.triggerAlert).not.toHaveBeenCalled();
    });

    it('should not crash when alertService is null', async () => {
      setupSubmitAnswers('red');
      await expect(
        service.submitAnswers('t1', 'student1', [
          { itemId: 'i1', optionId: 'o1' },
        ]),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated results without scope', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 't1' }], 1]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQb);
      const result = await service.findAll(1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by createdById when scope provided', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQb);
      await service.findAll(1, 20, { createdById: 'u1' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'task.createdById = :createdById',
        { createdById: 'u1' },
      );
    });

    it('should filter by classId for students', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockTaskRepo.createQueryBuilder.mockReturnValue(mockQb);
      await service.findAll(1, 20, { classId: 'c1', status: 'published' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'task.targetIds @> :classId::jsonb AND task.status = :status',
        expect.objectContaining({ status: 'published' }),
      );
    });
  });

  describe('findOne', () => {
    it('should load scale relations', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', scale: { items: [] } });
      const result = await service.findOne('t1');
      expect(mockTaskRepo.findOne).toHaveBeenCalledWith({
        where: { id: 't1' },
        relations: ['scale', 'scale.items', 'scale.items.options'],
      });
      expect(result.scale).toBeDefined();
    });

    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should merge data and save for draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', title: 'Old', status: 'draft' });
      mockTaskRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.update('t1', { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('should throw for non-draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      await expect(service.update('t1', { title: 'New' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if not creator', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft', createdById: 'u2' });
      await expect(service.update('t1', { title: 'New' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('should set status to published for draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      mockTaskRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.publish('t1');
      expect(result.status).toBe('published');
    });

    it('should reject publishing non-draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      await expect(service.publish('t1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.publish('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    it('should set status to completed for published tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      mockTaskRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.complete('t1');
      expect(result.status).toBe('completed');
    });

    it('should reject completing non-published tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await expect(service.complete('t1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      await service.remove('t1');
      expect(mockTaskRepo.delete).toHaveBeenCalledWith('t1');
    });

    it('should reject deleting non-draft tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'published' });
      await expect(service.remove('t1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStudentClassId', () => {
    it('should return classId when student exists', async () => {
      const mockUserRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ studentId: 's1' }),
        }),
      };
      mockDataSource.getRepository.mockReturnValue(mockUserRepo);
      mockStudentRepo.findOne.mockResolvedValue({ id: 's1', classId: 'c1' });
      const result = await service.getStudentClassId('u1');
      expect(result).toBe('c1');
    });

    it('should return null when user has no studentId', async () => {
      const mockUserRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(null),
        }),
      };
      mockDataSource.getRepository.mockReturnValue(mockUserRepo);
      const result = await service.getStudentClassId('u1');
      expect(result).toBeNull();
    });

    it('should return null when student not found', async () => {
      const mockUserRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ studentId: 's1' }),
        }),
      };
      mockDataSource.getRepository.mockReturnValue(mockUserRepo);
      mockStudentRepo.findOne.mockResolvedValue(null);
      const result = await service.getStudentClassId('u1');
      expect(result).toBeNull();
    });
  });

  describe('getSubmissionStatus', () => {
    it('should return submitted false when no answer exists', async () => {
      mockAnswerRepo.findOne.mockResolvedValue(null);
      const result = await service.getSubmissionStatus('t1', 's1');
      expect(result).toEqual({ submitted: false });
    });

    it('should return submitted true with status', async () => {
      mockAnswerRepo.findOne.mockResolvedValue({ status: 'submitted' });
      const result = await service.getSubmissionStatus('t1', 's1');
      expect(result).toEqual({ submitted: true, status: 'submitted' });
    });
  });
});
