/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ReportExportController } from './report-export.controller';
import { ExportService } from '../export/export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('ReportExportController', () => {
  let controller: ReportExportController;
  let exportService: any;

  const mockRes = {
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  const mockExportService = {
    generatePdf: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportExportController],
      providers: [{ provide: ExportService, useValue: mockExportService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportExportController>(ReportExportController);
    exportService = module.get(ExportService);
  });

  it('returns PDF buffer with correct Content-Type header', async () => {
    const buffer = Buffer.from('pdf-content');
    exportService.generatePdf.mockResolvedValueOnce(buffer);

    await controller.exportReport('r1', mockRes as any);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });

  it('calls generatePdf with correct resultId', async () => {
    exportService.generatePdf.mockResolvedValueOnce(Buffer.from('pdf'));
    await controller.exportReport('r1', mockRes as any);
    expect(exportService.generatePdf).toHaveBeenCalledWith('r1');
  });

  it('sets Cache-Control: no-store header', async () => {
    exportService.generatePdf.mockResolvedValueOnce(Buffer.from('pdf'));
    await controller.exportReport('r1', mockRes as any);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
