/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertNotification } from '../../entities/audit/alert-notification.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { NotFoundException } from '@nestjs/common';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepo: any;
  let notificationRepo: any;
  let studentRepo: any;
  let classRepo: any;
  let userRepo: any;
  let roleRepo: any;
  let hookBus: any;
  let dataScopeFilter: any;

  const mockAlertRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'a1' })),
  };

  const mockNotificationRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'n1' })),
  };

  const mockStudentRepo = {
    findOne: jest.fn(),
  };

  const mockClassRepo = {};

  const mockUserRepo = {
    find: jest.fn(),
  };

  const mockRoleRepo = {};

  const mockHookBus = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  const mockDataScopeFilter = {
    getStudentIds: jest.fn(),
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
        {
          provide: getRepositoryToken(Student),
          useValue: mockStudentRepo,
        },
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
    classRepo = module.get(getRepositoryToken(Class));
    userRepo = module.get(getRepositoryToken(User));
    roleRepo = module.get(getRepositoryToken(Role));
    hookBus = module.get(HookBus);
    dataScopeFilter = module.get(DataScopeFilter);
  });

  describe('findAll', () => {
    it('should return paginated alerts with scope=all', async () => {
      const alerts = [{ id: 'a1', status: 'pending' }];
      alertRepo.findAndCount.mockResolvedValue([alerts, 1]);
      const result = await service.findAll({ scope: 'all', userId: 'u1' });
      expect(result).toEqual({ data: alerts, total: 1 });
    });

    it('should filter by studentIds when scope=class', async () => {
      dataScopeFilter.getStudentIds.mockResolvedValue(['s1', 's2']);
      alertRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ scope: 'class', userId: 'u1', classId: 'c1' });
      expect(dataScopeFilter.getStudentIds).toHaveBeenCalledWith({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
    });

    it('should return empty when no studentIds', async () => {
      dataScopeFilter.getStudentIds.mockResolvedValue([]);
      const result = await service.findAll({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findOne', () => {
    it('should return alert', async () => {
      const alert = { id: 'a1', status: 'pending' };
      alertRepo.findOne.mockResolvedValue(alert);
      const result = await service.findOne('a1');
      expect(result).toEqual(alert);
    });

    it('should throw NotFoundException', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and save alert', async () => {
      const data = { resultId: 'r1', studentId: 's1', level: 'red' };
      alertRepo.save.mockResolvedValue({ ...data, id: 'a1' });
      const result = await service.create(data);
      expect(alertRepo.create).toHaveBeenCalledWith(data);
      expect(alertRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('a1');
    });
  });

  describe('handle', () => {
    it('should set status=handled', async () => {
      const alert = { id: 'a1', status: 'pending' };
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockResolvedValue({
        ...alert,
        status: 'handled',
        handledById: 'u1',
      });
      const result = await service.handle('a1', 'u1', 'note');
      expect(result.status).toBe('handled');
      expect(result.handledById).toBe('u1');
    });
  });

  describe('followup', () => {
    it('should set status=followup', async () => {
      const alert = { id: 'a1', status: 'pending' };
      alertRepo.findOne.mockResolvedValue(alert);
      alertRepo.save.mockResolvedValue({
        ...alert,
        status: 'followup',
        handledById: 'u1',
      });
      const result = await service.followup('a1', 'u1', 'note');
      expect(result.status).toBe('followup');
    });
  });

  describe('triggerAlert', () => {
    it('should create pending alert and emit hook', async () => {
      alertRepo.create.mockImplementation((d) => d);
      alertRepo.save.mockResolvedValue({
        resultId: 'r1',
        studentId: 's1',
        level: 'green',
        status: 'pending',
        id: 'a1',
      });
      userRepo.find.mockResolvedValue([]);
      const result = await service.triggerAlert('r1', 's1', 'green');
      expect(result.status).toBe('pending');
      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:alert.triggered',
        expect.objectContaining({
          alertId: 'a1',
          studentId: 's1',
          level: 'green',
        }),
      );
    });

    it('should notify users with red level', async () => {
      alertRepo.create.mockImplementation((d) => d);
      alertRepo.save.mockResolvedValueOnce({
        resultId: 'r1',
        studentId: 's1',
        level: 'red',
        status: 'pending',
        id: 'a1',
      });
      studentRepo.findOne.mockResolvedValue({ id: 's1' });
      userRepo.find.mockResolvedValue([
        { id: 'u1', roles: [{ name: '心理老师' }] },
        { id: 'u2', roles: [{ name: '班主任' }] },
      ]);
      notificationRepo.create.mockImplementation((d) => d);
      notificationRepo.save.mockResolvedValue([]);
      await service.triggerAlert('r1', 's1', 'red');
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('should notify users with yellow level', async () => {
      alertRepo.create.mockImplementation((d) => d);
      alertRepo.save.mockResolvedValueOnce({
        resultId: 'r1',
        studentId: 's1',
        level: 'yellow',
        status: 'pending',
        id: 'a1',
      });
      studentRepo.findOne.mockResolvedValue({ id: 's1' });
      userRepo.find.mockResolvedValue([
        { id: 'u1', roles: [{ name: '心理老师' }] },
      ]);
      notificationRepo.create.mockImplementation((d) => d);
      notificationRepo.save.mockResolvedValue([]);
      await service.triggerAlert('r1', 's1', 'yellow');
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('should not throw when hook fails', async () => {
      alertRepo.create.mockImplementation((d) => d);
      alertRepo.save.mockResolvedValueOnce({
        resultId: 'r1',
        studentId: 's1',
        level: 'green',
        status: 'pending',
        id: 'a1',
      });
      hookBus.emit.mockRejectedValue(new Error('hook fail'));
      userRepo.find.mockResolvedValue([]);
      await expect(
        service.triggerAlert('r1', 's1', 'green'),
      ).resolves.toBeDefined();
    });
  });

  describe('findNotifications', () => {
    it('should return paginated notifications', async () => {
      const notifs = [{ id: 'n1', targetUserId: 'u1' }];
      notificationRepo.findAndCount.mockResolvedValue([notifs, 1]);
      const result = await service.findNotifications('u1', 1, 20);
      expect(result).toEqual({ data: notifs, total: 1 });
    });
  });

  describe('markNotificationRead', () => {
    it('should set read=true', async () => {
      const notif = { id: 'n1', read: false };
      notificationRepo.findOne.mockResolvedValue(notif);
      notificationRepo.save.mockResolvedValue({ ...notif, read: true });
      const result = await service.markNotificationRead('n1');
      expect(result.read).toBe(true);
    });

    it('should throw NotFoundException', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      await expect(service.markNotificationRead('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
