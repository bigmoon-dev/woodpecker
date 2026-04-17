/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimelineService } from './timeline.service';
import { Interview } from '../../entities/interview/interview.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';

describe('TimelineService', () => {
  let service: TimelineService;
  let interviewRepo: any;
  let resultRepo: any;
  let alertRepo: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        {
          provide: getRepositoryToken(Interview),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(TaskResult),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              innerJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(AlertRecord),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
    interviewRepo = module.get(getRepositoryToken(Interview));
    resultRepo = module.get(getRepositoryToken(TaskResult));
    alertRepo = module.get(getRepositoryToken(AlertRecord));
  });

  describe('getTimeline', () => {
    it('should return empty events when no records exist', async () => {
      const result = await service.getTimeline('s1');

      expect(result.events).toEqual([]);
    });

    it('should return interview events', async () => {
      interviewRepo.find.mockResolvedValue([
        {
          id: 'iv1',
          interviewDate: new Date('2024-01-15'),
          status: 'reviewed',
          riskLevel: 'normal',
        },
      ]);

      const result = await service.getTimeline('s1');

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('interview');
      expect(result.events[0].summary).toContain('reviewed');
    });

    it('should return task_result events', async () => {
      resultRepo.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'tr1',
            createdAt: new Date('2024-01-10'),
            level: 'normal',
            color: 'green',
            totalScore: 85,
          },
        ]),
      });

      const result = await service.getTimeline('s1');

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('task_result');
    });

    it('should return alert events', async () => {
      alertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date('2024-01-05'),
          level: 'red',
          status: 'pending',
        },
      ]);

      const result = await service.getTimeline('s1');

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('alert');
    });

    it('should sort events by date descending', async () => {
      interviewRepo.find.mockResolvedValue([
        {
          id: 'iv1',
          interviewDate: new Date('2024-01-01'),
          status: 'draft',
          riskLevel: 'normal',
        },
      ]);
      alertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date('2024-01-15'),
          level: 'red',
          status: 'pending',
        },
      ]);

      const result = await service.getTimeline('s1');

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe('alert');
      expect(result.events[1].type).toBe('interview');
    });

    it('should combine all event types', async () => {
      interviewRepo.find.mockResolvedValue([
        {
          id: 'iv1',
          interviewDate: new Date('2024-01-01'),
          status: 'draft',
          riskLevel: 'normal',
        },
      ]);
      resultRepo.createQueryBuilder.mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'tr1',
            createdAt: new Date('2024-01-02'),
            level: 'normal',
            color: 'green',
            totalScore: 80,
          },
        ]),
      });
      alertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date('2024-01-03'),
          level: 'red',
          status: 'pending',
        },
      ]);

      const result = await service.getTimeline('s1');

      expect(result.events).toHaveLength(3);
    });
  });
});
