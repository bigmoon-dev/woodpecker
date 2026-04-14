/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: any;

  const mockDashboardService = {
    getOverview: jest.fn(),
    getCompletion: jest.fn(),
    getAlertDistribution: jest.fn(),
    getTrend: jest.fn(),
    getScaleUsage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get(DashboardService);
  });

  it('getOverview delegates with req.dataScope', async () => {
    dashboardService.getOverview.mockResolvedValueOnce({ total_tasks: 5 });
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;
    const result = await controller.getOverview(req, '2025-01-01');
    expect(dashboardService.getOverview).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
    expect(result).toEqual({ total_tasks: 5 });
  });

  it('getCompletion delegates', async () => {
    dashboardService.getCompletion.mockResolvedValueOnce([]);
    const req = {
      dataScope: { scope: 'class', userId: 'u1', classId: 'c1' },
    } as any;
    await controller.getCompletion(req, 't1');
    expect(dashboardService.getCompletion).toHaveBeenCalledWith(
      { scope: 'class', userId: 'u1', classId: 'c1' },
      't1',
    );
  });

  it('getAlertDistribution delegates', async () => {
    dashboardService.getAlertDistribution.mockResolvedValueOnce([]);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;
    await controller.getAlertDistribution(req, '2025-01-01');
    expect(dashboardService.getAlertDistribution).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      '2025-01-01',
    );
  });

  it('getTrend delegates with default startDate when not provided', async () => {
    dashboardService.getTrend.mockResolvedValueOnce([]);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;
    await controller.getTrend(req, undefined);
    expect(dashboardService.getTrend).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      expect.any(String),
    );
  });

  it('getScaleUsage delegates', async () => {
    dashboardService.getScaleUsage.mockResolvedValueOnce([]);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;
    await controller.getScaleUsage(req);
    expect(dashboardService.getScaleUsage).toHaveBeenCalledWith({
      scope: 'all',
      userId: 'u1',
    });
  });
});
