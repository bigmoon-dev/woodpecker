/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/await-thenable */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FollowupManageController } from './followup-manage.controller';
import { FollowupManageService } from './followup-manage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('FollowupManageController', () => {
  let controller: FollowupManageController;
  let service: any;

  const mockService = {
    getStudents: jest.fn(),
    getStudentDetail: jest.fn(),
    getThreshold: jest.fn(),
    updateThreshold: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowupManageController],
      providers: [{ provide: FollowupManageService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FollowupManageController>(FollowupManageController);
    service = module.get(FollowupManageService);
  });

  it('listStudents should call service.getStudents with dataScope', async () => {
    service.getStudents.mockResolvedValueOnce({ data: [], total: 0 });
    const req = {
      dataScope: { scope: 'all', userId: 'u1' },
    } as any;

    await controller.listStudents(req, { page: 1, pageSize: 20 } as any);

    expect(service.getStudents).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      1,
      20,
    );
  });

  it('getStudentDetail should call service.getStudentDetail', async () => {
    service.getStudentDetail.mockResolvedValueOnce({ studentId: 's1' });
    const req = {
      dataScope: { scope: 'all', userId: 'u1' },
    } as any;

    await controller.getStudentDetail('s1', req);

    expect(service.getStudentDetail).toHaveBeenCalledWith('s1', {
      scope: 'all',
      userId: 'u1',
    });
  });

  it('getConfig should call service.getThreshold', async () => {
    service.getThreshold.mockResolvedValueOnce({ threshold: 'yellow' });

    const result = await controller.getConfig();

    expect(service.getThreshold).toHaveBeenCalled();
    expect(result).toEqual({ threshold: 'yellow' });
  });

  it('updateConfig should call service.updateThreshold for admin', async () => {
    service.updateThreshold.mockResolvedValueOnce({
      threshold: 'red',
      oldValue: 'yellow',
    });
    const req = {
      user: {
        id: 'admin1',
        roles: [{ name: 'admin', permissions: [] }],
      },
    } as any;

    const result = await controller.updateConfig(
      { threshold: 'red' } as any,
      req,
    );

    expect(service.updateThreshold).toHaveBeenCalledWith('red', 'admin1');
    expect(result.threshold).toBe('red');
  });

  it('updateConfig should throw ForbiddenException for non-admin', async () => {
    const req = {
      user: {
        id: 'teacher1',
        roles: [{ name: 'teacher', permissions: [] }],
      },
    } as any;

    await expect(
      controller.updateConfig({ threshold: 'red' } as any, req),
    ).rejects.toThrow(ForbiddenException);

    expect(service.updateThreshold).not.toHaveBeenCalled();
  });
});
