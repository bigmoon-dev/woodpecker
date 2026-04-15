/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ResultService } from './result.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';

describe('ResultService - findByFilter', () => {
  let service: ResultService;
  let resultRepo: any;
  let studentRepo: any;
  let classRepo: any;
  let dataScopeFilter: any;
  let encryptionService: any;

  let mockQb: any;

  const mockResultRepo = { find: jest.fn() };
  const mockAnswerRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockStudentRepo = { find: jest.fn() };
  const mockClassRepo = { find: jest.fn() };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };
  const mockEncryptionService = {
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };

  function setupQueryBuilder(answers: any[] = []) {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(answers),
    };
    mockAnswerRepo.createQueryBuilder.mockReturnValue(mockQb);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    setupQueryBuilder([]);

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
    studentRepo = module.get(getRepositoryToken(Student));
    classRepo = module.get(getRepositoryToken(Class));
    dataScopeFilter = module.get(DataScopeFilter);
    encryptionService = module.get(EncryptionService);
  });

  it('filters by classId — finds students then answers', async () => {
    mockStudentRepo.find.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
    mockEncryptionService.batchDecrypt.mockResolvedValue(
      new Map([['s1', { name: 'Alice', studentNumber: '001' }]]),
    );

    const result = await service.findByFilter({
      classId: 'c1',
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(studentRepo.find).toHaveBeenCalledWith({
      where: { classId: 'c1' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].studentName).toBe('Alice');
  });

  it('filters by gradeId — finds classes then students', async () => {
    mockClassRepo.find.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    mockStudentRepo.find.mockResolvedValue([{ id: 's1' }]);
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
    mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());

    const result = await service.findByFilter({
      gradeId: 'g1',
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(classRepo.find).toHaveBeenCalledWith({ where: { gradeId: 'g1' } });
    expect(studentRepo.find).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('returns empty when gradeId yields no classes', async () => {
    mockClassRepo.find.mockResolvedValue([]);
    setupQueryBuilder([]);

    const result = await service.findByFilter({
      gradeId: 'g-empty',
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(result).toEqual([]);
  });

  it('filters by dataScope (non-all) using DataScopeFilter', async () => {
    mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);

    await service.findByFilter({
      dataScope: { scope: 'class', userId: 'u1', classId: 'c1' },
    });

    expect(dataScopeFilter.getStudentIds).toHaveBeenCalledWith({
      scope: 'class',
      userId: 'u1',
      classId: 'c1',
    });
  });

  it('applies no student filter when dataScope=all and no classId/gradeId', async () => {
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);

    await service.findByFilter({
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(studentRepo.find).not.toHaveBeenCalled();
    expect(classRepo.find).not.toHaveBeenCalled();
    expect(dataScopeFilter.getStudentIds).not.toHaveBeenCalled();
  });

  it('filters answers by taskId when provided', async () => {
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);

    await service.findByFilter({
      taskId: 'task-123',
      dataScope: { scope: 'all', userId: 'u1' },
    });

    const andWhereCalls = mockQb.andWhere.mock.calls.map((c: any[]) => c[0]);
    expect(andWhereCalls).toContain('ta.task_id = :taskId');
  });

  it('returns empty array when no submitted answers found', async () => {
    setupQueryBuilder([]);

    const result = await service.findByFilter({
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(result).toEqual([]);
    expect(resultRepo.find).not.toHaveBeenCalled();
  });

  it('calls batchDecrypt with unique student IDs from answers', async () => {
    const answers = [
      {
        id: 'a1',
        studentId: 's1',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
      {
        id: 'a2',
        studentId: 's1',
        task: { title: 'T2', scale: { name: 'S2' } },
      },
      {
        id: 'a3',
        studentId: 's2',
        task: { title: 'T1', scale: { name: 'S1' } },
      },
    ];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([
      { id: 'r1', answerId: 'a1' },
      { id: 'r2', answerId: 'a2' },
      { id: 'r3', answerId: 'a3' },
    ]);
    mockEncryptionService.batchDecrypt.mockResolvedValue(
      new Map([
        ['s1', { name: 'Alice', studentNumber: '001' }],
        ['s2', { name: 'Bob', studentNumber: '002' }],
      ]),
    );

    const result = await service.findByFilter({
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(encryptionService.batchDecrypt).toHaveBeenCalledWith(['s1', 's2']);
    expect(result).toHaveLength(3);
    expect(result[0].studentName).toBe('Alice');
    expect(result[2].studentName).toBe('Bob');
  });

  it('assembles ResultWithContext with fallback values for missing PII', async () => {
    const answers = [{ id: 'a1', studentId: 's1', task: null }];
    setupQueryBuilder(answers);
    mockResultRepo.find.mockResolvedValue([{ id: 'r1', answerId: 'a1' }]);
    mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());

    const result = await service.findByFilter({
      dataScope: { scope: 'all', userId: 'u1' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].studentName).toBe('');
    expect(result[0].studentNumber).toBe('');
    expect(result[0].taskTitle).toBe('');
    expect(result[0].scaleName).toBe('');
  });
});
