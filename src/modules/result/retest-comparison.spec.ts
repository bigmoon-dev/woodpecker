/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResultService, RetestComparison } from './result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';

describe('ResultService.compareResults', () => {
  let service: ResultService;
  let answerRepo: any;
  let resultRepo: any;

  const mockAnswerRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockResultRepo = { find: jest.fn() };
  const mockStudentRepo = { find: jest.fn() };
  const mockClassRepo = { find: jest.fn() };
  const mockGradeRepo = { find: jest.fn() };
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
      ],
    }).compile();
    service = module.get(ResultService);
    answerRepo = mockAnswerRepo;
    resultRepo = mockResultRepo;
  });

  function mockQueryBuilder(results: any[]) {
    const qb: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(results),
    };
    mockAnswerRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  it('returns insufficient when no answers found', async () => {
    mockQueryBuilder([]);
    const result = await service.compareResults('s1', 'scale1');
    expect(result.trend).toBe('insufficient');
    expect(result.history).toEqual([]);
    expect(result.delta).toBeNull();
  });

  it('returns single history entry with no delta', async () => {
    mockQueryBuilder([{ id: 'a1', task: { scale: { name: 'PHQ-9' } } }]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 5,
        dimensionScores: null,
        level: '正常',
        color: 'green',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.history.length).toBe(1);
    expect(result.delta).toBeNull();
    expect(result.trend).toBe('insufficient');
    expect(result.scaleName).toBe('PHQ-9');
  });

  it('computes delta between two results', async () => {
    mockQueryBuilder([
      { id: 'a1', task: { scale: { name: 'PHQ-9' } } },
      { id: 'a2', task: { scale: { name: 'PHQ-9' } } },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 5,
        dimensionScores: null,
        level: '正常',
        color: 'green',
        createdAt: new Date('2026-01-01'),
      },
      {
        answerId: 'a2',
        totalScore: 15,
        dimensionScores: null,
        level: '中度',
        color: 'yellow',
        createdAt: new Date('2026-03-01'),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.delta).toBe(10);
    expect(result.trend).toBe('rising');
    expect(result.levelTransition).toBe('正常 → 中度');
  });

  it('computes dimension deltas', async () => {
    mockQueryBuilder([
      { id: 'a1', task: { scale: { name: 'SCL-90' } } },
      { id: 'a2', task: { scale: { name: 'SCL-90' } } },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 100,
        dimensionScores: { anxiety: 20, depression: 30 },
        level: '正常',
        color: 'green',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 120,
        dimensionScores: { anxiety: 25, depression: 35 },
        level: '轻度',
        color: 'yellow',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.dimensionDeltas).toEqual({ anxiety: 5, depression: 5 });
    expect(result.delta).toBe(20);
  });

  it('detects declining trend', async () => {
    mockQueryBuilder([
      { id: 'a1', task: {} },
      { id: 'a2', task: {} },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 20,
        dimensionScores: null,
        level: '中度',
        color: 'yellow',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 10,
        dimensionScores: null,
        level: '轻度',
        color: 'green',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.trend).toBe('declining');
    expect(result.delta).toBe(-10);
  });

  it('detects stable trend', async () => {
    mockQueryBuilder([
      { id: 'a1', task: {} },
      { id: 'a2', task: {} },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 10,
        dimensionScores: null,
        level: '轻度',
        color: 'green',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 10,
        dimensionScores: null,
        level: '轻度',
        color: 'green',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.trend).toBe('stable');
    expect(result.delta).toBe(0);
  });

  it('handles three or more results in history', async () => {
    mockQueryBuilder([
      { id: 'a1', task: {} },
      { id: 'a2', task: {} },
      { id: 'a3', task: {} },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 5,
        dimensionScores: null,
        level: '正常',
        color: 'green',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 10,
        dimensionScores: null,
        level: '轻度',
        color: 'yellow',
        createdAt: new Date(),
      },
      {
        answerId: 'a3',
        totalScore: 20,
        dimensionScores: null,
        level: '中度',
        color: 'orange',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.history.length).toBe(3);
    expect(result.delta).toBe(15);
    expect(result.levelTransition).toBe('正常 → 中度');
  });

  it('handles missing dimensionScores gracefully', async () => {
    mockQueryBuilder([
      { id: 'a1', task: {} },
      { id: 'a2', task: {} },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 5,
        dimensionScores: null,
        level: '正常',
        color: 'green',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 10,
        dimensionScores: { anxiety: 10 },
        level: '轻度',
        color: 'yellow',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.dimensionDeltas).toEqual({ anxiety: 10 });
  });

  it('returns correct scaleName from joined scale relation', async () => {
    mockQueryBuilder([
      { id: 'a1', task: { scale: { name: 'PHQ-9 抑郁量表' } } },
      { id: 'a2', task: { scale: { name: 'PHQ-9 抑郁量表' } } },
    ]);
    mockResultRepo.find.mockResolvedValue([
      {
        answerId: 'a1',
        totalScore: 5,
        dimensionScores: { q1: 2, q2: 3 },
        level: '正常',
        color: 'green',
        createdAt: new Date(),
      },
      {
        answerId: 'a2',
        totalScore: 15,
        dimensionScores: { q1: 8, q2: 7 },
        level: '中度',
        color: 'red',
        createdAt: new Date(),
      },
    ]);

    const result = await service.compareResults('s1', 'scale1');
    expect(result.scaleName).toBe('PHQ-9 抑郁量表');
  });
});
