/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
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

  const mockTaskRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 't1' })),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    delete: jest.fn(),
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
  const mockScoringEngine = { calculate: jest.fn() };
  const mockScaleService = { findOne: jest.fn() };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };

  const setupSubmitAnswers = (color: string) => {
    mockTaskRepo.findOne.mockResolvedValue({ id: 't1', scaleId: 's1' });
    mockAnswerRepo.findOne.mockResolvedValueOnce(null);
    mockAnswerRepo.create.mockImplementation((d: any) => d);
    mockAnswerRepo.save.mockImplementation((d: any) =>
      Promise.resolve({ ...d, id: 'a1' }),
    );
    mockAnswerItemRepo.create.mockImplementation((d: any) => d);
    mockAnswerItemRepo.save.mockResolvedValue([]);
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
    mockResultRepo.create.mockImplementation((d: any) => d);
    mockResultRepo.save.mockResolvedValue({ id: 'r1', color });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
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
        { provide: ScoringEngine, useValue: mockScoringEngine },
        { provide: ScaleService, useValue: mockScaleService },
        { provide: HookBus, useValue: mockHookBus },
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

  describe('submitAnswers hooks', () => {
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
          resultId: 'r1',
        }),
      );
    });

    it('should not throw when on:assessment.submitted hook emit fails', async () => {
      setupSubmitAnswers('green');
      mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));
      await expect(
        service.submitAnswers('t1', 'student1', [
          { itemId: 'i1', optionId: 'o1' },
        ]),
      ).resolves.toBeDefined();
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
      expect(mockAlertService.triggerAlert).toHaveBeenCalledWith(
        'r1',
        'student1',
        'red',
      );
    });

    it('should trigger alert when result color is yellow', async () => {
      setupSubmitAnswers('yellow');
      const mockAlertService = {
        triggerAlert: jest.fn().mockResolvedValue(undefined),
      };
      service.setAlertService(mockAlertService as any);
      await service.submitAnswers('t1', 'student1', [
        { itemId: 'i1', optionId: 'o1' },
      ]);
      expect(mockAlertService.triggerAlert).toHaveBeenCalledWith(
        'r1',
        'student1',
        'yellow',
      );
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
    it('should return paginated results', async () => {
      const tasks = [{ id: 't1' }, { id: 't2' }];
      mockTaskRepo.findAndCount.mockResolvedValueOnce([tasks, 2]);
      const result = await service.findAll(1, 20);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockTaskRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  describe('update', () => {
    it('should merge data and save', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', title: 'Old' });
      mockTaskRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.update('t1', { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.update('x', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('should set status to published', async () => {
      mockTaskRepo.findOne.mockResolvedValue({ id: 't1', status: 'draft' });
      mockTaskRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.publish('t1');
      expect(result.status).toBe('published');
    });

    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.publish('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException for missing task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });
});
