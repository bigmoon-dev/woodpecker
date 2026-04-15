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

  it('getAlertTrendByMonth with scope=all returns monthly aggregation', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        period: '2025-01',
        red_count: '3',
        yellow_count: '5',
        total_count: '8',
      },
      {
        period: '2025-02',
        red_count: '1',
        yellow_count: '2',
        total_count: '3',
      },
    ]);
    const result = await service.getAlertTrendByMonth(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2025-01');
    expect(result[0].red_count).toBe('3');
  });

  it('getAlertTrendByMonth with scope=grade passes filter params', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getAlertTrendByMonth(
      { scope: 'grade', userId: 'u1', gradeId: 'g1' },
      '2025-01-01',
    );
    const [, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(params).toContain('g1');
  });

  it('getAlertTrendByMonth with period=semester uses semester expression', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        period: '2025-S1',
        red_count: '5',
        yellow_count: '8',
        total_count: '13',
      },
    ]);
    const result = await service.getAlertTrendByMonth(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
      undefined,
      'semester',
    );
    expect(result[0].period).toBe('2025-S1');
    const [sql] = dataSource.query.mock.calls[0] as [string];
    expect(sql).toContain('CASE');
    expect(sql).toContain('-S1');
    expect(sql).toContain('-S2');
  });

  it('getAlertTrendByMonth with endDate adds range filter', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getAlertTrendByMonth(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
      '2025-06-30',
    );
    const [sql, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(sql).toContain('<=');
    expect(params).toContain('2025-06-30');
  });

  it('getAlertTrendByMonth without startDate uses default', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    const result = await service.getAlertTrendByMonth(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
    const [sql] = dataSource.query.mock.calls[0] as [string];
    expect(sql).toContain('TO_CHAR');
    expect(result).toEqual([]);
  });

  it('getRiskHeatmap with scope=all returns grade×class aggregation', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        grade_name: '高一',
        class_name: '1班',
        red_students: '2',
        yellow_students: '3',
        total_alert_students: '5',
      },
    ]);
    const result = await service.getRiskHeatmap({
      scope: 'all',
      userId: 'u1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].grade_name).toBe('高一');
    expect(result[0].red_students).toBe('2');
  });

  it('getRiskHeatmap with scope=class filters to single class', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getRiskHeatmap({
      scope: 'class',
      userId: 'u1',
      classId: 'c1',
    });
    const [, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(params).toContain('c1');
  });

  it('getRiskHeatmap with date range applies both filters', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getRiskHeatmap(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
      '2025-06-30',
    );
    const [sql, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(sql).toContain('>=');
    expect(sql).toContain('<=');
    expect(params).toContain('2025-01-01');
    expect(params).toContain('2025-06-30');
  });

  it('getAlertTrendByMonth with scope=own filters by userId', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getAlertTrendByMonth(
      { scope: 'own', userId: 'u1' },
      '2025-01-01',
    );
    const [sql, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(sql).toContain('u.id');
    expect(params).toContain('u1');
  });

  it('getRiskHeatmap with scope=grade filters by gradeId', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await service.getRiskHeatmap({
      scope: 'grade',
      userId: 'u1',
      gradeId: 'g1',
    });
    const [, params] = dataSource.query.mock.calls[0] as [string, any[]];
    expect(params).toContain('g1');
  });
});
