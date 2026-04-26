/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TemplateService } from './template.service';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { Interview } from '../../entities/interview/interview.entity';

describe('TemplateService', () => {
  let service: TemplateService;
  let templateRepo: any;

  const mockTemplateRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: d.id || 't1' })),
    remove: jest.fn(),
  };
  const mockInterviewRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockInterviewRepo.count.mockResolvedValue(0);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: getRepositoryToken(InterviewTemplate),
          useValue: mockTemplateRepo,
        },
        {
          provide: getRepositoryToken(Interview),
          useValue: mockInterviewRepo,
        },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
    templateRepo = module.get(getRepositoryToken(InterviewTemplate));
  });

  describe('create', () => {
    it('should create a template', async () => {
      const dto = { name: 'Test Template', fields: [] };
      mockTemplateRepo.save.mockResolvedValue({ ...dto, id: 't1' });

      const result = await service.create(dto);

      expect(templateRepo.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('t1');
    });
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      const templates = [{ id: 't1', name: 'Template 1' }];
      mockTemplateRepo.find.mockResolvedValue(templates);

      const result = await service.findAll();

      expect(result).toEqual(templates);
      expect(templateRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a template by id', async () => {
      const template = { id: 't1', name: 'Template 1' };
      mockTemplateRepo.findOne.mockResolvedValue(template);

      const result = await service.findOne('t1');

      expect(result).toEqual(template);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a template', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({
        id: 't1',
        name: 'Old',
      });
      mockTemplateRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.update('t1', { name: 'New' });

      expect(templateRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('New');
    });

    it('should throw NotFoundException when updating non-existent', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete a template', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ id: 't1' });

      await service.delete('t1');

      expect(templateRepo.remove).toHaveBeenCalledWith({ id: 't1' });
    });

    it('should throw NotFoundException when deleting non-existent', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when template has interview references', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ id: 't1' });
      mockInterviewRepo.count.mockResolvedValue(3);

      await expect(service.delete('t1')).rejects.toThrow(ConflictException);
    });
  });
});
