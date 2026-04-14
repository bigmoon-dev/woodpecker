/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DataSource } from 'typeorm';

describe('DashboardService', () => {
  let service: DashboardService;
  let dataSource: any;

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    dataSource = module.get(DataSource);
  });

  it('getOverview with scope=all', async () => {
    dataSource.query.mockResolvedValueOnce([
      { total_tasks: 10, total_answers: 50 },
    ]);
    const result = await service.getOverview({
      scope: 'all',
      userId: 'u1',
    });
    expect(result).toEqual({ total_tasks: 10, total_answers: 50 });
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('getOverview with startDate', async () => {
    dataSource.query.mockResolvedValueOnce([
      { total_tasks: 5, total_answers: 25 },
    ]);
    const result = await service.getOverview(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
    expect(result).toEqual({ total_tasks: 5, total_answers: 25 });
    const [, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(params).toContain('2025-01-01');
  });

  it('getCompletion with taskId', async () => {
    dataSource.query.mockResolvedValueOnce([
      { grade_name: 'G1', class_name: 'C1', total_students: 30, completed: 20 },
    ]);
    const result = await service.getCompletion(
      { scope: 'all', userId: 'u1' },
      't1',
    );
    expect(result).toEqual([
      { grade_name: 'G1', class_name: 'C1', total_students: 30, completed: 20 },
    ]);
  });

  it('getCompletion without taskId', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getCompletion({ scope: 'all', userId: 'u1' });
    const [sql] = dataSource.query.mock.calls[0] as [string];
    expect(sql).not.toContain('$1');
  });

  it('getAlertDistribution', async () => {
    dataSource.query.mockResolvedValueOnce([
      { level: 'red', count: '3' },
      { level: 'yellow', count: '5' },
    ]);
    const result = await service.getAlertDistribution({
      scope: 'all',
      userId: 'u1',
    });
    expect(result).toEqual([
      { level: 'red', count: '3' },
      { level: 'yellow', count: '5' },
    ]);
  });

  it('getTrend', async () => {
    dataSource.query.mockResolvedValueOnce([
      { date: '2025-01-01', total: '10', green: '5', yellow: '3', red: '2' },
    ]);
    const result = await service.getTrend(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
    expect(result).toHaveLength(1);
    expect(result[0].total).toBe('10');
  });

  it('getScaleUsage', async () => {
    dataSource.query.mockResolvedValueOnce([
      { scale_name: 'PHQ-9', task_count: '3', answer_count: '50' },
    ]);
    const result = await service.getScaleUsage({ scope: 'all', userId: 'u1' });
    expect(result).toEqual([
      { scale_name: 'PHQ-9', task_count: '3', answer_count: '50' },
    ]);
  });
});
