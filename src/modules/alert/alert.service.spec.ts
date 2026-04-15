/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AlertService } from './alert.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter } from '../auth/data-scope-filter';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: any;
  let notificationRepo: any;
  let studentRepo: any;
  let userRepo: any;
  let hookBus: any;
  let dataScopeFilter: any;

  const mockAlertRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: d.id || 'alert1' })),
  };
  const mockNotificationRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const mockStudentRepo = { findOne: jest.fn() };
  const mockClassRepo = { findOne: jest.fn() };
  const mockUserRepo = { find: jest.fn() };
  const mockRoleRepo = { findOne: jest.fn() };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: getRepositoryToken(AlertRecord),
          useValue: mockAlertRepo,
        },
        {
          provide: getRepositoryToken(AlertNotification),
          useValue: mockNotificationRepo,
        },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: HookBus, useValue: mockHookBus },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepo = module.get(getRepositoryToken(AlertRecord));
    notificationRepo = module.get(getRepositoryToken(AlertNotification));
    studentRepo = module.get(getRepositoryToken(Student));
    userRepo = module.get(getRepositoryToken(User));
    hookBus = module.get(HookBus);
    dataScopeFilter = module.get(DataScopeFilter);
  });

  describe('findAll', () => {
    it('should find all alerts with scope=all', async () => {
      const alerts = [{ id: 'a1' }];
      mockAlertRepo.findAndCount.mockResolvedValue([alerts, 1]);

      const result = await service.findAll(
        { scope: 'all', userId: 'u1' },
        undefined,
        1,
        20,
      );

      expect(result).toEqual({ data: alerts, total: 1 });
      expect(dataScopeFilter.getStudentIds).not.toHaveBeenCalled();
    });

    it('should filter alerts by dataScope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockAlertRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { scope: 'class' as const, userId: 'u1', classId: 'c1' },
        undefined,
        1,
        20,
      );

      expect(dataScopeFilter.getStudentIds).toHaveBeenCalled();
    });

    it('should return empty when no students in scope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue([]);

      const result = await service.findAll({
        scope: 'class' as const,
        userId: 'u1',
      });

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should filter alerts by status', async () => {
      mockAlertRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ scope: 'all', userId: 'u1' }, 'pending');

      expect(alertRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an alert by id', async () => {
      const alert = { id: 'a1', status: 'pending' };
      mockAlertRepo.findOne.mockResolvedValue(alert);

      const result = await service.findOne('a1');

      expect(result).toEqual(alert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      mockAlertRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create an alert', async () => {
      const data = { resultId: 'r1', studentId: 's1', level: 'red' };
      mockAlertRepo.save.mockResolvedValue({ ...data, id: 'a1' });

      const result = await service.create(data);

      expect(alertRepo.create).toHaveBeenCalledWith(data);
      expect(result.id).toBe('a1');
    });
  });

  describe('handle', () => {
    it('should handle an alert', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'pending',
      });

      await service.handle('a1', 'u1', 'handled note');

      expect(alertRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'handled',
          handledById: 'u1',
          handleNote: 'handled note',
        }),
      );
    });

    it('should emit on:alert.resolved after handle', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'pending',
      });
      mockAlertRepo.save.mockResolvedValue({
        id: 'a1',
        status: 'handled',
        handledById: 'u1',
        handleNote: 'handled note',
      });

      await service.handle('a1', 'u1', 'handled note');

      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:alert.resolved',
        expect.objectContaining({
          alertId: 'a1',
          status: 'handled',
          handledById: 'u1',
        }),
      );
    });

    it('should not throw when on:alert.resolved emit fails', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'pending',
      });
      mockAlertRepo.save.mockResolvedValue({
        id: 'a1',
        status: 'handled',
        handledById: 'u1',
        handleNote: 'note',
      });
      mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));

      await expect(
        service.handle('a1', 'u1', 'note'),
      ).resolves.toBeDefined();
    });
  });

  describe('followup', () => {
    it('should followup an alert', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'handled',
      });

      await service.followup('a1', 'u1', 'followup note');

      expect(alertRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'followup',
          handledById: 'u1',
          handleNote: 'followup note',
        }),
      );
    });

    it('should emit on:alert.resolved after followup', async () => {
      mockAlertRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: 'handled',
      });
      mockAlertRepo.save.mockResolvedValue({
        id: 'a1',
        status: 'followup',
        handledById: 'u1',
        handleNote: 'followup note',
      });

      await service.followup('a1', 'u1', 'followup note');

      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:alert.resolved',
        expect.objectContaining({
          alertId: 'a1',
          status: 'followup',
          handledById: 'u1',
        }),
      );
    });
  });

  describe('triggerAlert', () => {
    it('should trigger alert and emit hook', async () => {
      mockAlertRepo.save.mockResolvedValue({
        id: 'alert1',
        resultId: 'r1',
        studentId: 's1',
        level: 'green',
        status: 'pending',
      });

      const result = await service.triggerAlert('r1', 's1', 'green');

      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:alert.triggered',
        expect.objectContaining({
          alertId: 'alert1',
          studentId: 's1',
          level: 'green',
        }),
      );
      expect(result.status).toBe('pending');
    });

    it('should not throw when hook emit fails', async () => {
      mockAlertRepo.save.mockResolvedValue({
        id: 'alert1',
        resultId: 'r1',
        studentId: 's1',
        level: 'green',
        status: 'pending',
      });
      mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));

      await expect(
        service.triggerAlert('r1', 's1', 'green'),
      ).resolves.toBeDefined();
    });

    it('should notify both roles for red alert', async () => {
      mockAlertRepo.save.mockResolvedValue({
        id: 'alert1',
        resultId: 'r1',
        studentId: 's1',
        level: 'red',
        status: 'pending',
      });
      mockStudentRepo.findOne.mockResolvedValue({ id: 's1', classId: 'c1' });
      mockUserRepo.find.mockResolvedValue([
        {
          id: 'u1',
          roles: [{ name: '心理老师' }],
        },
        {
          id: 'u2',
          roles: [{ name: '班主任' }],
        },
      ]);

      await service.triggerAlert('r1', 's1', 'red');

      expect(notificationRepo.save).toHaveBeenCalled();
      const saved = notificationRepo.save.mock.calls[0][0];
      expect(saved).toHaveLength(2);
    });

    it('should notify only psychologist for yellow alert', async () => {
      mockAlertRepo.save.mockResolvedValue({
        id: 'alert1',
        resultId: 'r1',
        studentId: 's1',
        level: 'yellow',
        status: 'pending',
      });
      mockStudentRepo.findOne.mockResolvedValue({ id: 's1', classId: 'c1' });
      mockUserRepo.find.mockResolvedValue([
        {
          id: 'u1',
          roles: [{ name: '心理老师' }],
        },
        {
          id: 'u2',
          roles: [{ name: '班主任' }],
        },
      ]);

      await service.triggerAlert('r1', 's1', 'yellow');

      expect(notificationRepo.save).toHaveBeenCalled();
      const saved = notificationRepo.save.mock.calls[0][0];
      expect(saved).toHaveLength(1);
      expect(saved[0].targetRole).toBe('心理老师');
    });
  });

  describe('findNotifications', () => {
    it('should find notifications for user with pagination', async () => {
      const notifs = [{ id: 'n1' }];
      mockNotificationRepo.findAndCount.mockResolvedValue([notifs, 1]);

      const result = await service.findNotifications('u1', 1, 20);

      expect(result).toEqual({ data: notifs, total: 1 });
      expect(notificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { targetUserId: 'u1' } }),
      );
    });
  });

  describe('markNotificationRead', () => {
    it('should mark notification as read', async () => {
      mockNotificationRepo.findOne.mockResolvedValue({
        id: 'n1',
        read: false,
      });

      const result = await service.markNotificationRead('n1');

      expect(result.read).toBe(true);
    });

    it('should throw NotFoundException when notification not found', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(service.markNotificationRead('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
