/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { OrgImportService } from './org-import.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('OrgController', () => {
  let controller: OrgController;
  let orgService: any;
  let orgImportService: any;

  const mockRes = {
    setHeader: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  const mockOrgService = {
    createGrade: jest.fn(),
    findAllGrades: jest.fn(),
    createClass: jest.fn(),
  };

  const mockOrgImportService = {
    parseExcel: jest.fn(),
    importStudents: jest.fn(),
    generateTemplate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgController],
      providers: [
        { provide: OrgService, useValue: mockOrgService },
        { provide: OrgImportService, useValue: mockOrgImportService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrgController>(OrgController);
    orgService = module.get(OrgService);
    orgImportService = module.get(OrgImportService);
  });

  it('createGrade delegates', async () => {
    orgService.createGrade.mockResolvedValueOnce({ id: 'g1' });
    const dto = { name: 'Grade 1', sortOrder: 0 };
    const result = await controller.createGrade(dto as any);
    expect(orgService.createGrade).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'g1' });
  });

  it('findAllGrades passes dataScope', async () => {
    orgService.findAllGrades.mockResolvedValueOnce({ data: [], total: 0 });
    const req = {
      dataScope: { scope: 'all', userId: 'u1' },
    } as any;
    await controller.findAllGrades(req, { page: 1, pageSize: 20 } as any);
    expect(orgService.findAllGrades).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      1,
      20,
    );
  });

  it('createClass delegates', async () => {
    orgService.createClass.mockResolvedValueOnce({ id: 'c1' });
    const dto = { gradeId: 'g1', name: 'Class 1', sortOrder: 0 };
    const result = await controller.createClass(dto as any);
    expect(orgService.createClass).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'c1' });
  });

  it('importStudents delegates with file', async () => {
    orgImportService.parseExcel.mockResolvedValueOnce({
      validRows: [{ name: 'stu1' }],
      errors: [],
    });
    orgImportService.importStudents.mockResolvedValueOnce({
      total: 1,
      created: 1,
      skipped: 0,
      errors: [],
    });

    const file = { buffer: Buffer.from('data') } as Express.Multer.File;
    const result = await controller.importStudents(file);

    expect(orgImportService.parseExcel).toHaveBeenCalledWith(file.buffer);
    expect(orgImportService.importStudents).toHaveBeenCalledWith([
      { name: 'stu1' },
    ]);
    expect(result.total).toBe(1);
    expect(result.created).toBe(1);
  });

  it('importStudents throws BadRequestException without file', async () => {
    await expect(controller.importStudents(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('downloadTemplate sets Content-Type and sends buffer', async () => {
    const buffer = Buffer.from('template');
    orgImportService.generateTemplate.mockResolvedValueOnce(buffer);

    await controller.downloadTemplate(mockRes as any);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename=student-import-template.xlsx',
    );
    expect(mockRes.send).toHaveBeenCalledWith(buffer);
  });
});
