/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskService } from './task.service';
import { Task } from '../../entities/task/task.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { TaskAnswerItem } from '../../entities/task/task-answer-item.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { ScoringEngine } from '../scoring/scoring.engine';
import { ScaleService } from '../scale/scale.service';
import { HookBus } from '../plugin/hook-bus';

describe('TaskService Hook emit', () => {
  let service: TaskService;
  let hookBus: any;

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
  });

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

  it('should emit on:assessment.submitted after submitAnswers', async () => {
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
      level: 'normal',
      color: 'green',
      suggestion: '',
    });
    mockResultRepo.create.mockImplementation((d: any) => d);
    mockResultRepo.save.mockResolvedValue({ id: 'r1' });

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
      level: 'normal',
      color: 'green',
      suggestion: '',
    });
    mockResultRepo.create.mockImplementation((d: any) => d);
    mockResultRepo.save.mockResolvedValue({ id: 'r1' });
    mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));

    await expect(
      service.submitAnswers('t1', 'student1', [
        { itemId: 'i1', optionId: 'o1' },
      ]),
    ).resolves.toBeDefined();
  });
});
