/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SummaryExtractionService } from './summary-extraction.service';
import { Interview } from '../../entities/interview/interview.entity';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';

describe('SummaryExtractionService', () => {
  let service: SummaryExtractionService;
  let interviewRepo: any;

  const mockInterviewRepo = {
    findOne: jest.fn(),
    save: jest.fn((d: any) => Promise.resolve(d)),
  };
  const mockTemplateRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryExtractionService,
        {
          provide: getRepositoryToken(Interview),
          useValue: mockInterviewRepo,
        },
        {
          provide: getRepositoryToken(InterviewTemplate),
          useValue: mockTemplateRepo,
        },
      ],
    }).compile();

    service = module.get<SummaryExtractionService>(SummaryExtractionService);
    interviewRepo = module.get(getRepositoryToken(Interview));
  });

  describe('extract', () => {
    it('should throw NotFoundException when interview not found', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(service.extract('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no template assigned', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: null,
      });

      await expect(service.extract('iv1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText: 'some text',
      });
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(service.extract('iv1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no OCR text', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText: '   ',
      });
      mockTemplateRepo.findOne.mockResolvedValue({ id: 't1', fields: [] });

      await expect(service.extract('iv1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when template has no fields', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText: 'some text',
      });
      mockTemplateRepo.findOne.mockResolvedValue({ id: 't1', fields: [] });

      await expect(service.extract('iv1')).rejects.toThrow(BadRequestException);
    });

    it('should extract fields using regex pattern', async () => {
      const ocrText = '学生姓名：张三\n年龄：15\n';
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText,
      });
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        fields: [
          {
            key: 'name',
            label: '姓名',
            type: 'text',
            extractionRule: { pattern: '学生姓名[：:]\\s*(.+?)(?:\\n|$)' },
          },
        ],
      });

      const result = await service.extract('iv1');
      const summary = result.structuredSummary as Record<string, string>;

      expect(summary.name).toBe('张三');
      expect(interviewRepo.save).toHaveBeenCalled();
    });

    it('should extract fields using label matching', async () => {
      const ocrText = '年龄: 16岁\n';
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText,
      });
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        fields: [
          {
            key: 'age',
            label: '年龄',
            type: 'text',
          },
        ],
      });

      const result = await service.extract('iv1');
      const summary = result.structuredSummary as Record<string, string>;

      expect(summary.age).toBe('16岁');
    });

    it('should extract fields using section header', async () => {
      const ocrText = '一、基本信息\n张三 15岁\n二、家庭情况\n父亲：教师\n';
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText,
      });
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        fields: [
          {
            key: 'basicInfo',
            label: '基本信息',
            type: 'paragraph',
            extractionRule: { section: '基本信息' },
          },
        ],
      });

      const result = await service.extract('iv1');
      const summary = result.structuredSummary as Record<string, string>;

      expect(summary.basicInfo).toBe('张三 15岁');
    });

    it('should return empty string for unmatched fields', async () => {
      const ocrText = 'some unrelated text';
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText,
      });
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        fields: [
          {
            key: 'unknown',
            label: '未知字段',
            type: 'text',
          },
        ],
      });

      const result = await service.extract('iv1');
      const summary = result.structuredSummary as Record<string, string>;

      expect(summary.unknown).toBe('');
    });

    it('should handle null ocrText', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText: null,
      });
      mockTemplateRepo.findOne.mockResolvedValue({ id: 't1', fields: [] });

      await expect(service.extract('iv1')).rejects.toThrow(BadRequestException);
    });

    it('should extract multiple fields from same text', async () => {
      const ocrText = '学生姓名：李四\n班级：高一3班\n访谈日期：2024-03-15\n';
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        templateId: 't1',
        ocrText,
      });
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        fields: [
          { key: 'name', label: '学生姓名', type: 'text' },
          { key: 'class', label: '班级', type: 'text' },
          { key: 'date', label: '访谈日期', type: 'date' },
        ],
      });

      const result = await service.extract('iv1');
      const summary = result.structuredSummary as Record<string, string>;

      expect(summary.name).toBe('李四');
      expect(summary.class).toBe('高一3班');
      expect(summary.date).toBe('2024-03-15');
    });
  });
});
