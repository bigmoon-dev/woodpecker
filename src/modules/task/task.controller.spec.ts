/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';

describe('TaskController', () => {
  let controller: TaskController;
  let taskService: any;

  const mockReq = (user: any) => ({ user } as any);

  const mockTaskService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    submitAnswers: jest.fn(),
    publish: jest.fn(),
    complete: jest.fn(),
    getStudentClassId: jest.fn(),
    getSubmissionStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: mockTaskService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ConsentGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TaskController>(TaskController);
    taskService = module.get(TaskService);
  });

  describe('create', () => {
    it('should extract createdById from JWT and set targetType to class', async () => {
      taskService.create.mockResolvedValueOnce({ id: 't1' });
      await controller.create(
        { scaleId: 's1', title: 'Task', targetIds: ['tg1'] } as any,
        mockReq({ id: 'u1', roles: [{ name: 'teacher', permissions: [] }] }),
      );
      expect(taskService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdById: 'u1',
          targetType: 'class',
        }),
      );
    });

    it('should parse deadline string to Date', async () => {
      taskService.create.mockResolvedValueOnce({ id: 't1' });
      await controller.create(
        {
          scaleId: 's1',
          title: 'Task',
          targetIds: ['tg1'],
          deadline: '2025-12-31',
        } as any,
        mockReq({ id: 'u1', roles: [] }),
      );
      expect(taskService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deadline: expect.any(Date),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should filter by classId for students', async () => {
      taskService.getStudentClassId.mockResolvedValueOnce('class1');
      taskService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
      const result = await controller.findAll(
        { page: 1, pageSize: 10 } as any,
        mockReq({
          id: 'u1',
          roles: [{ name: 'student', permissions: [] }],
        }),
      );
      expect(taskService.findAll).toHaveBeenCalledWith(1, 10, {
        classId: 'class1',
        status: 'published',
      });
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should return empty for students without classId', async () => {
      taskService.getStudentClassId.mockResolvedValueOnce(null);
      const result = await controller.findAll(
        { page: 1, pageSize: 10 } as any,
        mockReq({
          id: 'u1',
          roles: [{ name: 'student', permissions: [] }],
        }),
      );
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should filter by createdById for teachers', async () => {
      taskService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
      await controller.findAll(
        { page: 1, pageSize: 10 } as any,
        mockReq({
          id: 'u1',
          roles: [{ name: 'teacher', permissions: [] }],
        }),
      );
      expect(taskService.findAll).toHaveBeenCalledWith(1, 10, {
        createdById: 'u1',
      });
    });

    it('should not filter for admin', async () => {
      taskService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
      await controller.findAll(
        { page: 1, pageSize: 10 } as any,
        mockReq({
          id: 'u1',
          roles: [{ name: 'admin', permissions: [] }],
        }),
      );
      expect(taskService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('submitAnswers', () => {
    it('should extract studentId from JWT', async () => {
      taskService.submitAnswers.mockResolvedValueOnce({ id: 'tr1' });
      const dto = { items: [{ itemId: 'i1', optionId: 'o1' }] };
      await controller.submitAnswers(
        't1',
        dto as any,
        mockReq({ id: 'u1', roles: [] }),
      );
      expect(taskService.submitAnswers).toHaveBeenCalledWith('t1', 'u1', [
        { itemId: 'i1', optionId: 'o1' },
      ]);
    });
  });

  describe('update', () => {
    it('should parse deadline and pass userId', async () => {
      taskService.update.mockResolvedValueOnce({ id: 't1', title: 'New' });
      await controller.update(
        't1',
        { title: 'New', deadline: '2025-12-31' } as any,
        mockReq({ id: 'u1', roles: [] }),
      );
      expect(taskService.update).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          title: 'New',
          deadline: expect.any(Date),
        }),
        'u1',
      );
    });
  });

  it('publish delegates to service', async () => {
    taskService.publish.mockResolvedValueOnce({
      id: 't1',
      status: 'published',
    });
    await controller.publish('t1');
    expect(taskService.publish).toHaveBeenCalledWith('t1');
  });

  it('findOne delegates to service', async () => {
    taskService.findOne.mockResolvedValueOnce({ id: 't1' });
    const result = await controller.findOne('t1');
    expect(taskService.findOne).toHaveBeenCalledWith('t1');
    expect(result).toEqual({ id: 't1' });
  });
});
