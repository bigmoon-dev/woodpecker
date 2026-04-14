/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('AlertController', () => {
  let controller: AlertController;
  let alertService: any;

  const mockAlertService = {
    findAll: jest.fn(),
    handle: jest.fn(),
    followup: jest.fn(),
    findNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertController],
      providers: [{ provide: AlertService, useValue: mockAlertService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AlertController>(AlertController);
    alertService = module.get(AlertService);
  });

  it('GET / delegates to findAll with req.dataScope and pagination', async () => {
    const req = {
      dataScope: { scope: 'all', userId: 'u1' },
    } as any;
    alertService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
    await controller.findAll(req, { page: 1, pageSize: 20 } as any, undefined);
    expect(alertService.findAll).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      undefined,
      1,
      20,
    );
  });

  it('POST /:id/handle delegates to handle with req.user.id', async () => {
    const req = { user: { id: 'u1' } } as any;
    alertService.handle.mockResolvedValueOnce({ id: 'a1', status: 'handled' });
    await controller.handle('a1', { handleNote: 'done' } as any, req);
    expect(alertService.handle).toHaveBeenCalledWith('a1', 'u1', 'done');
  });

  it('POST /:id/followup delegates to followup with req.user.id', async () => {
    const req = { user: { id: 'u1' } } as any;
    alertService.followup.mockResolvedValueOnce({
      id: 'a1',
      status: 'followup',
    });
    await controller.followup('a1', { handleNote: 'follow' } as any, req);
    expect(alertService.followup).toHaveBeenCalledWith('a1', 'u1', 'follow');
  });

  it('GET /notifications delegates to findNotifications with req.user.id', async () => {
    const req = { user: { id: 'u1' } } as any;
    alertService.findNotifications.mockResolvedValueOnce({
      data: [],
      total: 0,
    });
    await controller.findNotifications(req, { page: 1, pageSize: 20 } as any);
    expect(alertService.findNotifications).toHaveBeenCalledWith('u1', 1, 20);
  });

  it('POST /notifications/:id/read delegates to markNotificationRead', async () => {
    alertService.markNotificationRead.mockResolvedValueOnce({
      id: 'n1',
      read: true,
    });
    await controller.markNotificationRead('n1');
    expect(alertService.markNotificationRead).toHaveBeenCalledWith('n1');
  });
});
