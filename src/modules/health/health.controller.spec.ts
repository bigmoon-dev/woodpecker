/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let health: any;
  let db: any;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockDb = {
    pingCheck: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    health = module.get(HealthCheckService);
    db = module.get(TypeOrmHealthIndicator);
  });

  it('check() returns healthy', async () => {
    const healthyResult: HealthCheckResult = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
    health.check.mockImplementation(async (fns: any[]) => {
      for (const fn of fns) await fn();
      return healthyResult;
    });
    db.pingCheck.mockResolvedValue({ database: { status: 'up' } });

    const result = await controller.check();
    expect(result.status).toBe('ok');
  });

  it('readiness() returns healthy', async () => {
    const healthyResult: HealthCheckResult = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
    health.check.mockImplementation(async (fns: any[]) => {
      for (const fn of fns) await fn();
      return healthyResult;
    });
    db.pingCheck.mockResolvedValue({ database: { status: 'up' } });

    const result = await controller.readiness();
    expect(result.status).toBe('ok');
  });

  it('check() handles unhealthy DB', async () => {
    const unhealthyResult: HealthCheckResult = {
      status: 'error',
      info: {},
      error: { database: { status: 'down' } },
      details: { database: { status: 'down' } },
    };
    health.check.mockImplementation(async (fns: any[]) => {
      for (const fn of fns) await fn();
      return unhealthyResult;
    });
    db.pingCheck.mockResolvedValue({ database: { status: 'down' } });

    const result = await controller.check();
    expect(result.status).toBe('error');
  });
});
