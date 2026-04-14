/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { ConsentGuard } from '../consent/consent.guard';

describe('ResultController', () => {
  let controller: ResultController;
  let resultService: any;

  const mockResultService = {
    findByStudent: jest.fn(),
    findByClass: jest.fn(),
    findByGrade: jest.fn(),
    findByScope: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResultController],
      providers: [{ provide: ResultService, useValue: mockResultService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ConsentGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ResultController>(ResultController);
    resultService = module.get(ResultService);
  });

  it('findMyResults uses req.user.studentId when present', async () => {
    resultService.findByStudent.mockResolvedValueOnce([]);
    const req = {
      user: { id: 'u1', studentId: 's1', username: 'test', roles: [] },
    } as any;
    await controller.findMyResults(req);
    expect(resultService.findByStudent).toHaveBeenCalledWith('s1');
  });

  it('findMyResults falls back to req.user.id when studentId undefined', async () => {
    resultService.findByStudent.mockResolvedValueOnce([]);
    const req = {
      user: { id: 'u1', username: 'test', roles: [] },
    } as any;
    await controller.findMyResults(req);
    expect(resultService.findByStudent).toHaveBeenCalledWith('u1');
  });

  it('findByClass passes pagination params', async () => {
    resultService.findByClass.mockResolvedValueOnce({ data: [], total: 0 });
    await controller.findByClass('c1', { page: 2, pageSize: 10 } as any);
    expect(resultService.findByClass).toHaveBeenCalledWith('c1', 2, 10);
  });

  it('findByGrade passes pagination params', async () => {
    resultService.findByGrade.mockResolvedValueOnce({ data: [], total: 0 });
    await controller.findByGrade('g1', { page: 3, pageSize: 5 } as any);
    expect(resultService.findByGrade).toHaveBeenCalledWith('g1', 3, 5);
  });

  it('findByScope uses req.dataScope', async () => {
    resultService.findByScope.mockResolvedValueOnce([]);
    const dataScope = { scope: 'all' as const, userId: 'u1' };
    const req = { dataScope } as any;
    await controller.findByScope(req);
    expect(resultService.findByScope).toHaveBeenCalledWith(dataScope);
  });
});
