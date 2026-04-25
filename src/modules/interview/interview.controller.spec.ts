/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { TemplateService } from './template.service';
import { TimelineService } from './timeline.service';
import { FollowUpService } from './follow-up.service';
import { OcrService } from './ocr.service';
import { SummaryExtractionService } from './summary-extraction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

async function flushMicrotasks(n = 10) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

describe('InterviewController', () => {
  let controller: InterviewController;
  let interviewService: any;
  let templateService: any;
  let timelineService: any;
  let followUpService: any;
  let ocrService: any;
  let summaryExtractionService: any;

  const mockInterviewService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getFiles: jest.fn(),
    updateFileOcr: jest.fn().mockResolvedValue({}),
    addFile: jest.fn(),
    deleteFile: jest.fn(),
    updateStatus: jest.fn(),
    aggregateOcrText: jest.fn(),
  };
  const mockTemplateService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mockTimelineService = {
    getTimeline: jest.fn(),
  };
  const mockFollowUpService = {
    create: jest.fn(),
    findPending: jest.fn(),
    markComplete: jest.fn(),
  };
  const mockOcrService = {
    recognize: jest.fn(),
  };
  const mockSummaryExtractionService = {
    extract: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewController],
      providers: [
        { provide: InterviewService, useValue: mockInterviewService },
        { provide: TemplateService, useValue: mockTemplateService },
        { provide: TimelineService, useValue: mockTimelineService },
        { provide: FollowUpService, useValue: mockFollowUpService },
        { provide: OcrService, useValue: mockOcrService },
        {
          provide: SummaryExtractionService,
          useValue: mockSummaryExtractionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InterviewController>(InterviewController);
    interviewService = module.get(InterviewService);
    templateService = module.get(TemplateService);
    timelineService = module.get(TimelineService);
    followUpService = module.get(FollowUpService);
    ocrService = module.get(OcrService);
    summaryExtractionService = module.get(SummaryExtractionService);
  });

  it('GET / delegates to findAll', async () => {
    const req = {
      dataScope: { scope: 'all', userId: 'u1' },
    } as any;
    interviewService.findAll.mockResolvedValueOnce({ data: [], total: 0 });
    await controller.findAll(
      req,
      { page: 1, pageSize: 20 } as any,
      undefined,
      undefined,
    );
    expect(interviewService.findAll).toHaveBeenCalledWith(
      { scope: 'all', userId: 'u1' },
      undefined,
      undefined,
      1,
      20,
    );
  });

  it('GET /:id delegates to findOne with req.user.id', async () => {
    const req = { user: { id: 'u1' } } as any;
    interviewService.findOne.mockResolvedValueOnce({ id: 'iv1' });
    await controller.findOne('iv1', req);
    expect(interviewService.findOne).toHaveBeenCalledWith('iv1', 'u1');
  });

  it('POST / delegates to create', async () => {
    const dto = {
      studentId: 's1',
      psychologistId: 'p1',
      interviewDate: '2024-01-01',
    };
    interviewService.create.mockResolvedValueOnce({ id: 'iv1', ...dto });
    await controller.create(dto as any);
    expect(interviewService.create).toHaveBeenCalledWith(dto);
  });

  it('PUT /:id delegates to update', async () => {
    interviewService.update.mockResolvedValueOnce({
      id: 'iv1',
      status: 'reviewed',
    });
    await controller.update('iv1', { status: 'reviewed' } as any);
    expect(interviewService.update).toHaveBeenCalledWith('iv1', {
      status: 'reviewed',
    });
  });

  it('DELETE /:id delegates to delete', async () => {
    interviewService.delete.mockResolvedValueOnce(undefined);
    await controller.delete('iv1');
    expect(interviewService.delete).toHaveBeenCalledWith('iv1');
  });

  it('GET /templates/all delegates to findAllTemplates', async () => {
    templateService.findAll.mockResolvedValueOnce([]);
    await controller.findAllTemplates();
    expect(templateService.findAll).toHaveBeenCalled();
  });

  it('GET /templates/:id delegates to findOneTemplate', async () => {
    templateService.findOne.mockResolvedValueOnce({ id: 't1', name: 'T1' });
    await controller.findOneTemplate('t1');
    expect(templateService.findOne).toHaveBeenCalledWith('t1');
  });

  it('PUT /templates/:id delegates to updateTemplate', async () => {
    templateService.update.mockResolvedValueOnce({ id: 't1', name: 'Updated' });
    await controller.updateTemplate('t1', { name: 'Updated' } as any);
    expect(templateService.update).toHaveBeenCalledWith('t1', {
      name: 'Updated',
    });
  });

  it('DELETE /templates/:id delegates to deleteTemplate', async () => {
    templateService.delete.mockResolvedValueOnce(undefined);
    await controller.deleteTemplate('t1');
    expect(templateService.delete).toHaveBeenCalledWith('t1');
  });

  it('POST /templates delegates to createTemplate', async () => {
    const dto = { name: 'T1', fields: [] };
    templateService.create.mockResolvedValueOnce({ id: 't1', ...dto });
    await controller.createTemplate(dto as any);
    expect(templateService.create).toHaveBeenCalledWith(dto);
  });

  it('GET /timeline/:studentId delegates to getTimeline', async () => {
    timelineService.getTimeline.mockResolvedValueOnce({ events: [] });
    await controller.getTimeline('s1');
    expect(timelineService.getTimeline).toHaveBeenCalledWith('s1');
  });

  it('POST /:id/follow-up delegates to createFollowUp', async () => {
    const dto = {
      studentId: 's1',
      reminderDate: '2024-02-01',
    };
    followUpService.create.mockResolvedValueOnce({
      id: 'r1',
      interviewId: 'iv1',
      ...dto,
    });
    await controller.createFollowUp('iv1', dto as any);
    expect(followUpService.create).toHaveBeenCalledWith({
      interviewId: 'iv1',
      ...dto,
    });
  });

  it('GET /follow-ups/pending delegates to findPending', async () => {
    followUpService.findPending.mockResolvedValueOnce([]);
    await controller.findPending();
    expect(followUpService.findPending).toHaveBeenCalled();
  });

  it('PUT /follow-ups/:id/complete delegates to markComplete', async () => {
    followUpService.markComplete.mockResolvedValueOnce({
      id: 'r1',
      completed: true,
    });
    await controller.markComplete('r1');
    expect(followUpService.markComplete).toHaveBeenCalledWith('r1');
  });

  it('POST /:id/files/:fileId/ocr triggers OCR and auto-extracts summary', async () => {
    interviewService.getFiles.mockResolvedValueOnce([
      { id: 'f1', filePath: '/img.png' },
    ]);
    ocrService.recognize.mockResolvedValueOnce({
      text: 'result',
      confidence: 0.9,
    });
    interviewService.updateFileOcr.mockResolvedValueOnce({
      id: 'f1',
      ocrStatus: 'done',
    });
    interviewService.aggregateOcrText.mockResolvedValueOnce({ id: 'iv1' });
    summaryExtractionService.extract.mockResolvedValueOnce({ id: 'iv1' });

    const result = await controller.triggerOcr('iv1', 'f1');

    expect(ocrService.recognize).toHaveBeenCalledWith('/img.png');
    expect(interviewService.updateFileOcr).toHaveBeenCalledWith(
      'f1',
      { text: 'result', confidence: 0.9 },
      'done',
    );
    expect(interviewService.aggregateOcrText).toHaveBeenCalledWith('iv1');
    expect(summaryExtractionService.extract).toHaveBeenCalledWith('iv1');
    expect((result as any).text).toBe('result');
  });

  it('POST /:id/files/:fileId/ocr throws BadRequestException when file not found', async () => {
    interviewService.getFiles.mockResolvedValueOnce([]);

    await expect(controller.triggerOcr('iv1', 'f1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('POST /:id/files returns interview file and triggers async OCR', async () => {
    const file = {
      id: 'f1',
      interviewId: 'iv1',
      filePath: '/upload/test.png',
      fileType: 'image',
    };
    interviewService.addFile.mockResolvedValueOnce(file);
    let ocrResolve: (v: any) => void;
    const ocrPromise = new Promise((resolve) => {
      ocrResolve = resolve;
    });
    mockOcrService.recognize.mockReturnValueOnce(ocrPromise);
    interviewService.updateFileOcr.mockResolvedValueOnce({
      id: 'f1',
      ocrStatus: 'done',
    });
    interviewService.aggregateOcrText.mockResolvedValueOnce({ id: 'iv1' });

    const result = await controller.uploadFile('iv1', {
      path: '/upload/test.png',
      mimetype: 'image/png',
    } as Express.Multer.File);

    expect(interviewService.addFile).toHaveBeenCalledWith(
      'iv1',
      '/upload/test.png',
      'image',
    );
    expect(result).toEqual(file);

    ocrResolve!({ text: 'ocr result' });
    await flushMicrotasks();

    expect(interviewService.updateFileOcr).toHaveBeenCalledWith(
      'f1',
      { text: 'ocr result' },
      'done',
    );
    expect(interviewService.aggregateOcrText).toHaveBeenCalledWith('iv1');
    expect(summaryExtractionService.extract).toHaveBeenCalledWith('iv1');
  });

  it('POST /:id/files handles summary extraction failure gracefully', async () => {
    const file = {
      id: 'f1',
      interviewId: 'iv1',
      filePath: '/upload/test.png',
      fileType: 'image',
    };
    interviewService.addFile.mockResolvedValueOnce(file);
    let ocrResolve: (v: any) => void;
    const ocrPromise = new Promise((resolve) => {
      ocrResolve = resolve;
    });
    mockOcrService.recognize.mockReturnValueOnce(ocrPromise);
    interviewService.updateFileOcr.mockResolvedValueOnce({
      id: 'f1',
      ocrStatus: 'done',
    });
    interviewService.aggregateOcrText.mockResolvedValueOnce({ id: 'iv1' });
    summaryExtractionService.extract.mockRejectedValueOnce(
      new Error('no template'),
    );

    await controller.uploadFile('iv1', {
      path: '/upload/test.png',
      mimetype: 'image/png',
    } as Express.Multer.File);

    ocrResolve!({ text: 'ocr result' });
    await flushMicrotasks();

    expect(summaryExtractionService.extract).toHaveBeenCalledWith('iv1');
  });

  it('POST /:id/files handles OCR failure gracefully', async () => {
    const file = {
      id: 'f1',
      interviewId: 'iv1',
      filePath: '/upload/test.png',
      fileType: 'image',
    };
    interviewService.addFile.mockResolvedValueOnce(file);
    let ocrReject: (e: any) => void;
    const ocrPromise = new Promise((_, reject) => {
      ocrReject = reject;
    });
    mockOcrService.recognize.mockReturnValueOnce(ocrPromise);
    interviewService.updateFileOcr.mockResolvedValueOnce({
      id: 'f1',
      ocrStatus: 'failed',
    });

    await controller.uploadFile('iv1', {
      path: '/upload/test.png',
      mimetype: 'image/png',
    } as Express.Multer.File);

    ocrReject!(new Error('OCR failed'));
    await flushMicrotasks();

    expect(interviewService.updateFileOcr).toHaveBeenCalledWith(
      'f1',
      null,
      'failed',
    );
  });

  it('POST /:id/files classifies PDF mimetype correctly', async () => {
    const file = {
      id: 'f2',
      interviewId: 'iv1',
      filePath: '/upload/doc.pdf',
      fileType: 'pdf',
    };
    interviewService.addFile.mockResolvedValueOnce(file);
    mockOcrService.recognize.mockRejectedValueOnce(new Error('ocr fail'));

    await controller.uploadFile('iv1', {
      path: '/upload/doc.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File);

    expect(interviewService.addFile).toHaveBeenCalledWith(
      'iv1',
      '/upload/doc.pdf',
      'pdf',
    );
  });

  it('POST /:id/files throws BadRequestException when no file', async () => {
    await expect(controller.uploadFile('iv1', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('GET /:id/files delegates to getFiles', async () => {
    const files = [{ id: 'f1', interviewId: 'iv1' }];
    interviewService.getFiles.mockResolvedValueOnce(files);

    const result = await controller.getFiles('iv1');

    expect(interviewService.getFiles).toHaveBeenCalledWith('iv1');
    expect(result).toEqual(files);
  });

  it('DELETE /:id/files/:fileId delegates to deleteFile with interviewId', async () => {
    interviewService.deleteFile.mockResolvedValueOnce(undefined);
    await controller.deleteFile('iv1', 'f1');
    expect(interviewService.deleteFile).toHaveBeenCalledWith('f1', 'iv1');
  });

  it('PUT /:id/status delegates to updateStatus', async () => {
    interviewService.updateStatus.mockResolvedValueOnce({
      id: 'iv1',
      status: 'reviewed',
    });
    await controller.updateStatus('iv1', { status: 'reviewed' } as any);
    expect(interviewService.updateStatus).toHaveBeenCalledWith(
      'iv1',
      'reviewed',
    );
  });

  it('POST /:id/extract-summary delegates to summaryExtractionService', async () => {
    summaryExtractionService.extract.mockResolvedValueOnce({
      id: 'iv1',
      structuredSummary: { name: 'test' },
    });
    await controller.extractSummary('iv1');
    expect(summaryExtractionService.extract).toHaveBeenCalledWith('iv1');
  });
});
