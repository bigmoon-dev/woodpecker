/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ResultService } from '../result/result.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('ExportController', () => {
  let controller: ExportController;
  let exportService: any;
  let resultService: any;

  const mockRes = {
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  const mockExportService = {
    generateExcel: jest.fn(),
    generatePdf: jest.fn(),
  };

  const mockResultService = {
    findByFilter: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        { provide: ExportService, useValue: mockExportService },
        { provide: ResultService, useValue: mockResultService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExportController>(ExportController);
    exportService = module.get(ExportService);
    resultService = module.get(ResultService);
  });

  it('exportByTask sets Excel Content-Type and sends buffer', async () => {
    const buffer = Buffer.from('excel');
    resultService.findByFilter.mockResolvedValueOnce([{ id: 'r1' }]);
    exportService.generateExcel.mockResolvedValueOnce(buffer);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;

    await controller.exportByTask(
      't1',
      undefined,
      undefined,
      req,
      mockRes as any,
    );

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });

  it('exportByTask returns 400 when >10000 results', async () => {
    const results = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    resultService.findByFilter.mockResolvedValueOnce(results);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;

    await controller.exportByTask(
      't1',
      undefined,
      undefined,
      req,
      mockRes as any,
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: '导出数据量超过10000条，请缩小筛选范围',
    });
    expect(exportService.generateExcel).not.toHaveBeenCalled();
  });

  it('exportByFilter POST body filter forwarded to service', async () => {
    const buffer = Buffer.from('excel');
    resultService.findByFilter.mockResolvedValueOnce([]);
    exportService.generateExcel.mockResolvedValueOnce(buffer);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;
    const filter = { taskId: 't1', classId: 'c1' };

    await controller.exportByFilter(filter, req, mockRes as any);

    expect(resultService.findByFilter).toHaveBeenCalledWith({
      taskId: 't1',
      classId: 'c1',
      dataScope: req.dataScope,
    });
  });

  it('exportByFilter returns 400 when >10000 results', async () => {
    const results = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    resultService.findByFilter.mockResolvedValueOnce(results);
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;

    await controller.exportByFilter({}, req, mockRes as any);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: '导出数据量超过10000条，请缩小筛选范围',
    });
  });

  it('exportPdf sets PDF headers and sends buffer', async () => {
    const buffer = Buffer.from('pdf');
    exportService.generatePdf.mockResolvedValueOnce(buffer);

    await controller.exportPdf('r1', mockRes as any);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });

  it('sets Cache-Control: no-store on exportByTask', async () => {
    resultService.findByFilter.mockResolvedValueOnce([]);
    exportService.generateExcel.mockResolvedValueOnce(Buffer.from('x'));
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;

    await controller.exportByTask(
      't1',
      undefined,
      undefined,
      req,
      mockRes as any,
    );

    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('sets Cache-Control: no-store on exportByFilter', async () => {
    resultService.findByFilter.mockResolvedValueOnce([]);
    exportService.generateExcel.mockResolvedValueOnce(Buffer.from('x'));
    const req = { dataScope: { scope: 'all', userId: 'u1' } } as any;

    await controller.exportByFilter({}, req, mockRes as any);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('sets Cache-Control: no-store on exportPdf', async () => {
    exportService.generatePdf.mockResolvedValueOnce(Buffer.from('pdf'));

    await controller.exportPdf('r1', mockRes as any);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
