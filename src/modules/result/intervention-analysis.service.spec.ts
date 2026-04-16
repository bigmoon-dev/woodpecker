/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { InterventionAnalysisService } from './intervention-analysis.service';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Task } from '../../entities/task/task.entity';

describe('InterventionAnalysisService', () => {
  let service: InterventionAnalysisService;
  let taskRepo: any;
  let dataSource: any;

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterventionAnalysisService,
        {
          provide: getRepositoryToken(TaskResult),
          useValue: {},
        },
        {
          provide: getRepositoryToken(TaskAnswer),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Task),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<InterventionAnalysisService>(
      InterventionAnalysisService,
    );
    taskRepo = module.get(getRepositoryToken(Task));
    dataSource = module.get(DataSource);
  });

  describe('groupComparison()', () => {
    const makeTask = (id: string) => ({ id, scaleId: 'scale-1' });

    it('should compute group comparison between two tasks', async () => {
      taskRepo.findOne
        .mockResolvedValueOnce(makeTask('before-1'))
        .mockResolvedValueOnce(makeTask('after-1'));

      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
          {
            studentId: 's2',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 15,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
          {
            studentId: 's2',
            totalScore: 12,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ]);

      const result = await service.groupComparison('before-1', 'after-1');

      expect(result.beforeTaskId).toBe('before-1');
      expect(result.afterTaskId).toBe('after-1');
      expect(result.totalStudents).toBe(2);
      expect(result.beforeStats.avgScore).toBe(15);
      expect(result.afterStats.avgScore).toBe(13.5);
      expect(result.delta).toBe(-1.5);
      expect(result.improvedRate).toBe(50);
      expect(result.worsenedRate).toBe(50);
      expect(result.levelTransitions).toEqual({
        'normal→normal': 1,
        'mild→normal': 1,
      });
    });

    it('should throw NotFoundException for missing before task', async () => {
      taskRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.groupComparison('missing', 'after-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for missing after task', async () => {
      taskRepo.findOne
        .mockResolvedValueOnce(makeTask('before-1'))
        .mockResolvedValueOnce(null);
      await expect(
        service.groupComparison('before-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty results', async () => {
      taskRepo.findOne
        .mockResolvedValueOnce(makeTask('before-1'))
        .mockResolvedValueOnce(makeTask('after-1'));
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.groupComparison('before-1', 'after-1');
      expect(result.totalStudents).toBe(0);
      expect(result.beforeStats.avgScore).toBe(0);
      expect(result.improvedRate).toBe(0);
    });

    it('should handle students only in one task', async () => {
      taskRepo.findOne
        .mockResolvedValueOnce(makeTask('before-1'))
        .mockResolvedValueOnce(makeTask('after-1'));
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's2',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date(),
          },
        ]);

      const result = await service.groupComparison('before-1', 'after-1');
      expect(result.totalStudents).toBe(2);
      expect(result.improvedRate).toBe(0);
    });

    it('should compute level distribution correctly', async () => {
      taskRepo.findOne
        .mockResolvedValueOnce(makeTask('before-1'))
        .mockResolvedValueOnce(makeTask('after-1'));
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 5,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
          {
            studentId: 's2',
            totalScore: 15,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date(),
          },
          {
            studentId: 's3',
            totalScore: 25,
            level: 'severe',
            color: 'red',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 5,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
          {
            studentId: 's2',
            totalScore: 15,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
          {
            studentId: 's3',
            totalScore: 25,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date(),
          },
        ]);

      const result = await service.groupComparison('before-1', 'after-1');
      expect(result.beforeStats.levelDistribution).toEqual({
        normal: 1,
        mild: 1,
        severe: 1,
      });
    });
  });

  describe('getStudentProgress()', () => {
    it('should return progress for all students', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 15,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ]);

      const result = await service.getStudentProgress('before-1', 'after-1');
      expect(result).toHaveLength(1);
      expect(result[0].trend).toBe('improved');
      expect(result[0].delta).toBe(5);
    });

    it('should detect worsened trend', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ]);

      const result = await service.getStudentProgress('before-1', 'after-1');
      expect(result[0].trend).toBe('worsened');
    });

    it('should handle student only in before', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getStudentProgress('before-1', 'after-1');
      expect(result[0].trend).toBe('no_data');
      expect(result[0].afterScore).toBeNull();
    });

    it('should detect stable trend', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 10,
            level: 'normal',
            color: 'green',
            createdAt: new Date(),
          },
        ]);

      const result = await service.getStudentProgress('before-1', 'after-1');
      expect(result[0].trend).toBe('stable');
    });
  });

  describe('detectTrendAlerts()', () => {
    it('should detect declining trends from green to yellow/red', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', scaleId: 'scale-1' });

      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date('2026-02-01'),
          },
        ])
        .mockResolvedValueOnce([{ level: 'normal', color: 'green' }]);

      const mockAlertService = { create: jest.fn() };
      service.setAlertService(mockAlertService as any);

      const count = await service.detectTrendAlerts('t1');

      expect(count).toBe(1);
      expect(mockAlertService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 's1',
          resultId: '',
          level: 'yellow',
          status: 'pending',
          handleNote: expect.stringContaining('趋势恶化预警'),
        }),
      );
    });

    it('should not alert when previous was not green', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', scaleId: 'scale-1' });
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 30,
            level: 'severe',
            color: 'red',
            createdAt: new Date('2026-02-01'),
          },
        ])
        .mockResolvedValueOnce([{ level: 'mild', color: 'yellow' }]);

      const count = await service.detectTrendAlerts('t1');
      expect(count).toBe(0);
    });

    it('should not alert when no previous result', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', scaleId: 'scale-1' });
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date('2026-02-01'),
          },
        ])
        .mockResolvedValueOnce([]);

      const count = await service.detectTrendAlerts('t1');
      expect(count).toBe(0);
    });

    it('should throw NotFoundException for missing task', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.detectTrendAlerts('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle no alertService gracefully', async () => {
      taskRepo.findOne.mockResolvedValue({ id: 't1', scaleId: 'scale-1' });
      dataSource.query
        .mockResolvedValueOnce([
          {
            studentId: 's1',
            totalScore: 20,
            level: 'mild',
            color: 'yellow',
            createdAt: new Date('2026-02-01'),
          },
        ])
        .mockResolvedValueOnce([{ level: 'normal', color: 'green' }]);

      const count = await service.detectTrendAlerts('t1');
      expect(count).toBe(1);
    });
  });
});
