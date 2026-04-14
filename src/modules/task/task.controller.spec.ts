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

  const mockTaskService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    submitAnswers: jest.fn(),
    publish: jest.fn(),
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

  it('create parses deadline string to Date', async () => {
    taskService.create.mockResolvedValueOnce({ id: 't1' });
    await controller.create({
      scaleId: 's1',
      title: 'Task',
      targetIds: ['tg1'],
      createdById: 'u1',
      deadline: '2025-12-31' as any,
    } as any);
    expect(taskService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deadline: expect.any(Date),
      }),
    );
  });

  it('findAll delegates to service', async () => {
    taskService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
    const result = await controller.findAll({ page: 1, pageSize: 10 } as any);
    expect(taskService.findAll).toHaveBeenCalledWith(1, 10);
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('submitAnswers delegates with correct params', async () => {
    taskService.submitAnswers.mockResolvedValueOnce({ id: 'tr1' });
    const dto = { studentId: 's1', items: [{ itemId: 'i1', optionId: 'o1' }] };
    await controller.submitAnswers('t1', dto as any);
    expect(taskService.submitAnswers).toHaveBeenCalledWith('t1', 's1', [
      { itemId: 'i1', optionId: 'o1' },
    ]);
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
