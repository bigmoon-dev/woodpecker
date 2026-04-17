/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { TemplateService } from './template.service';
import { TimelineService } from './timeline.service';
import { FollowUpService } from './follow-up.service';
import { OcrService } from './ocr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('InterviewController', () => {
  let controller: InterviewController;
  let interviewService: any;
  let templateService: any;
  let timelineService: any;
  let followUpService: any;
  let ocrService: any;

  const mockInterviewService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getFiles: jest.fn(),
    updateFileOcr: jest.fn(),
  };
  const mockTemplateService = {
    findAll: jest.fn(),
    create: jest.fn(),
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
      interviewId: 'iv1',
      studentId: 's1',
      reminderDate: '2024-02-01',
    };
    followUpService.create.mockResolvedValueOnce({ id: 'r1', ...dto });
    await controller.createFollowUp(dto as any);
    expect(followUpService.create).toHaveBeenCalledWith(dto);
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

  it('POST /:id/files/:fileId/ocr triggers OCR', async () => {
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

    const result = await controller.triggerOcr('iv1', 'f1');

    expect(ocrService.recognize).toHaveBeenCalledWith('/img.png');
    expect(interviewService.updateFileOcr).toHaveBeenCalledWith(
      'f1',
      { text: 'result', confidence: 0.9 },
      'done',
    );
    expect((result as any).text).toBe('result');
  });

  it('POST /:id/files/:fileId/ocr returns error when file not found', async () => {
    interviewService.getFiles.mockResolvedValueOnce([]);

    const result = await controller.triggerOcr('iv1', 'f1');

    expect(result).toEqual({ error: 'File not found' });
  });
});
