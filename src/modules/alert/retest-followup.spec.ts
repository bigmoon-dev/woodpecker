/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { ResultService } from '../result/result.service';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter } from '../auth/data-scope-filter';

describe('Alert Followup Retest Comparison', () => {
  let controller: AlertController;
  let alertRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let resultRepo: { findOne: jest.Mock };
  let answerRepo: { createQueryBuilder: jest.Mock };

  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };
  const mockDataScopeFilter = { getStudentIds: jest.fn() };
  const mockResultService = { compareResults: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    alertRepo = {
      findOne: jest.fn(),
      save: jest.fn((d) => Promise.resolve(d)),
      create: jest.fn((d) => d),
    };
    resultRepo = { findOne: jest.fn() };
    answerRepo = { createQueryBuilder: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [
        AlertService,
        { provide: getRepositoryToken(AlertRecord), useValue: alertRepo },
        {
          provide: getRepositoryToken(AlertNotification),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Student),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Class),
          useValue: { findOne: jest.fn() },
        },
        { provide: getRepositoryToken(User), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Role), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(TaskResult), useValue: resultRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: answerRepo },
        { provide: HookBus, useValue: mockHookBus },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
        { provide: ResultService, useValue: mockResultService },
      ],
    }).compile();

    controller = module.get(AlertController);
  });

  it('returns retestComparisonUrl when alert has result with linked task', async () => {
    const alert = {
      id: 'a1',
      resultId: 'r1',
      studentId: 's1',
      level: 'red',
      status: 'pending',
    };
    alertRepo.findOne.mockResolvedValue(alert);
    resultRepo.findOne.mockResolvedValue({ id: 'r1', answerId: 'ans1' });

    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'ans1',
        task: { scaleId: 'scale-123' },
      }),
    };
    answerRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await controller.followup(
      'a1',
      { handleNote: '跟进中' } as any,
      { user: { id: 'u1' } } as any,
    );

    expect(result.retestComparisonUrl).toBe(
      '/api/results/compare?studentId=s1&scaleId=scale-123',
    );
    expect(result.alert.status).toBe('followup');
  });

  it('returns null retestComparisonUrl when task has no scaleId', async () => {
    const alert = {
      id: 'a3',
      resultId: 'r3',
      studentId: 's1',
      level: 'yellow',
      status: 'pending',
    };
    alertRepo.findOne.mockResolvedValue(alert);
    resultRepo.findOne.mockResolvedValue({ id: 'r3', answerId: 'ans3' });

    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValue({ id: 'ans3', task: { scaleId: null } }),
    };
    answerRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await controller.followup(
      'a3',
      { handleNote: '跟进中' } as any,
      { user: { id: 'u1' } } as any,
    );

    expect(result.retestComparisonUrl).toBeNull();
  });

  it('returns null retestComparisonUrl when result not found', async () => {
    const alert = {
      id: 'a2',
      resultId: 'r-missing',
      studentId: 's1',
      level: 'yellow',
      status: 'pending',
    };
    alertRepo.findOne.mockResolvedValue(alert);
    resultRepo.findOne.mockResolvedValue(null);

    const result = await controller.followup(
      'a2',
      { handleNote: '跟进中' } as any,
      { user: { id: 'u1' } } as any,
    );

    expect(result.retestComparisonUrl).toBeNull();
    expect(result.alert.status).toBe('followup');
  });
});
