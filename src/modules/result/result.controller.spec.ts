/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { InterventionAnalysisService } from './intervention-analysis.service';
import {
  ReportTemplateService,
  ReportGeneratorService,
} from './report-generator.service';
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
    compareResults: jest.fn(),
  };

  const mockInterventionService = {
    groupComparison: jest.fn(),
    getStudentProgress: jest.fn(),
    detectTrendAlerts: jest.fn(),
  };

  const mockReportTemplateService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockReportGeneratorService = {
    generateGroupReport: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResultController],
      providers: [
        { provide: ResultService, useValue: mockResultService },
        {
          provide: InterventionAnalysisService,
          useValue: mockInterventionService,
        },
        {
          provide: ReportTemplateService,
          useValue: mockReportTemplateService,
        },
        {
          provide: ReportGeneratorService,
          useValue: mockReportGeneratorService,
        },
      ],
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

  it('findMyResults falls back to req.user.id', async () => {
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

  describe('intervention endpoints', () => {
    it('interventionComparison delegates to service', async () => {
      mockInterventionService.groupComparison.mockResolvedValueOnce({
        beforeTaskId: 'b1',
        afterTaskId: 'a1',
      });
      const result = await controller.interventionComparison('b1', 'a1');
      expect(mockInterventionService.groupComparison).toHaveBeenCalledWith(
        'b1',
        'a1',
      );
      expect(result.beforeTaskId).toBe('b1');
    });

    it('interventionProgress delegates to service', async () => {
      mockInterventionService.getStudentProgress.mockResolvedValueOnce([]);
      const result = await controller.interventionProgress('b1', 'a1');
      expect(mockInterventionService.getStudentProgress).toHaveBeenCalledWith(
        'b1',
        'a1',
      );
      expect(result).toEqual([]);
    });

    it('scanTrendAlerts returns count', async () => {
      mockInterventionService.detectTrendAlerts.mockResolvedValueOnce(3);
      const result = await controller.scanTrendAlerts('t1');
      expect(result.alertsCreated).toBe(3);
    });
  });

  describe('report template endpoints', () => {
    it('listReportTemplates delegates', async () => {
      mockReportTemplateService.findAll.mockResolvedValueOnce([]);
      const result = await controller.listReportTemplates();
      expect(result).toEqual([]);
    });

    it('createReportTemplate delegates', async () => {
      const dto = { name: 'Test', schema: {} };
      mockReportTemplateService.create.mockResolvedValueOnce({
        id: 't1',
        ...dto,
      });
      await controller.createReportTemplate(dto);
      expect(mockReportTemplateService.create).toHaveBeenCalledWith(dto);
    });

    it('getReportTemplate delegates', async () => {
      mockReportTemplateService.findOne.mockResolvedValueOnce({
        id: 't1',
        name: 'Test',
      });
      const result = await controller.getReportTemplate('t1');
      expect(result.name).toBe('Test');
    });

    it('updateReportTemplate delegates', async () => {
      const dto = { name: 'Updated' };
      mockReportTemplateService.update.mockResolvedValueOnce({
        id: 't1',
        name: 'Updated',
      });
      await controller.updateReportTemplate('t1', dto);
      expect(mockReportTemplateService.update).toHaveBeenCalledWith('t1', dto);
    });

    it('deleteReportTemplate delegates', async () => {
      mockReportTemplateService.remove.mockResolvedValueOnce(undefined);
      const result = await controller.deleteReportTemplate('t1');
      expect(mockReportTemplateService.remove).toHaveBeenCalledWith('t1');
      expect(result).toEqual({ deleted: true });
    });

    it('generateGroupReport delegates', async () => {
      mockReportGeneratorService.generateGroupReport.mockResolvedValueOnce({
        taskId: 't1',
        totalStudents: 10,
      });
      const result = await controller.generateGroupReport('tpl-1', 't1');
      expect(
        mockReportGeneratorService.generateGroupReport,
      ).toHaveBeenCalledWith('tpl-1', 't1');
      expect(result.totalStudents).toBe(10);
    });
  });
});
