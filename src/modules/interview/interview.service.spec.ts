/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { Interview } from '../../entities/interview/interview.entity';
import { InterviewFile } from '../../entities/interview/interview-file.entity';
import { InterviewTemplate } from '../../entities/interview/interview-template.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { Student } from '../../entities/org/student.entity';
import { User } from '../../entities/auth/user.entity';
import { Role } from '../../entities/auth/role.entity';
import { EncryptionService } from '../core/encryption.service';
import { DataScopeFilter } from '../auth/data-scope-filter';

describe('InterviewService', () => {
  let service: InterviewService;
  let interviewRepo: any;
  let fileRepo: any;
  let encryptionService: any;
  let dataScopeFilter: any;

  const mockInterviewRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: d.id || 'iv1' })),
    remove: jest.fn(),
  };
  const mockFileRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
    remove: jest.fn(),
  };
  const mockTemplateRepo = { find: jest.fn() };
  const mockReminderRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockStudentRepo = { findOne: jest.fn() };
  const mockUserRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockRoleRepo = { findOne: jest.fn() };
  const mockEncryptionService = {
    encrypt: jest.fn().mockResolvedValue(Buffer.from('encrypted')),
    decrypt: jest.fn().mockResolvedValue('decrypted content'),
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: getRepositoryToken(Interview), useValue: mockInterviewRepo },
        { provide: getRepositoryToken(InterviewFile), useValue: mockFileRepo },
        {
          provide: getRepositoryToken(InterviewTemplate),
          useValue: mockTemplateRepo,
        },
        {
          provide: getRepositoryToken(FollowUpReminder),
          useValue: mockReminderRepo,
        },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
      ],
    }).compile();

    service = module.get<InterviewService>(InterviewService);
    interviewRepo = module.get(getRepositoryToken(Interview));
    fileRepo = module.get(getRepositoryToken(InterviewFile));
    encryptionService = module.get(EncryptionService);
    dataScopeFilter = module.get(DataScopeFilter);
  });

  describe('create', () => {
    it('should create an interview', async () => {
      const dto = {
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
      };
      mockInterviewRepo.save.mockResolvedValue({ ...dto, id: 'iv1' });

      const result = await service.create(dto);

      expect(interviewRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('iv1');
    });

    it('should encrypt content when provided', async () => {
      const dto = {
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
        content: 'secret content',
      };
      mockInterviewRepo.save.mockResolvedValue({ ...dto, id: 'iv1' });

      await service.create(dto);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('secret content');
    });

    it('should not call encrypt when content is not provided', async () => {
      const dto = {
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
      };
      mockInterviewRepo.save.mockResolvedValue({ ...dto, id: 'iv1' });

      await service.create(dto);

      expect(encryptionService.encrypt).not.toHaveBeenCalled();
    });

    it('should update FollowUpReminder when alertId is provided', async () => {
      const dto = {
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
        alertId: 'a1',
      };
      mockInterviewRepo.save.mockResolvedValue({ ...dto, id: 'iv1' });
      const mockQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockReminderRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.create(dto);

      expect(mockReminderRepo.createQueryBuilder).toHaveBeenCalled();
      expect(mockQb.set).toHaveBeenCalledWith({ interviewId: 'iv1' });
      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('should not update FollowUpReminder when alertId is not provided', async () => {
      const dto = {
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
      };
      mockInterviewRepo.save.mockResolvedValue({ ...dto, id: 'iv1' });

      await service.create(dto);

      expect(mockReminderRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should find all interviews with scope=all', async () => {
      const interviews = [{ id: 'iv1', studentId: 's1' }];
      mockInterviewRepo.findAndCount.mockResolvedValue([interviews, 1]);
      mockUserRepo.find.mockResolvedValue([]);

      const result = await service.findAll(
        { scope: 'all', userId: 'u1' },
        undefined,
        undefined,
        1,
        20,
      );

      expect(result).toEqual({
        data: [{ id: 'iv1', studentId: 's1', studentName: '' }],
        total: 1,
      });
      expect(dataScopeFilter.getStudentIds).not.toHaveBeenCalled();
    });

    it('should filter interviews by dataScope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue(['s1']);
      mockInterviewRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(
        { scope: 'class' as const, userId: 'u1', classId: 'c1' },
        undefined,
        undefined,
        1,
        20,
      );

      expect(dataScopeFilter.getStudentIds).toHaveBeenCalled();
    });

    it('should return empty when no students in scope', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValue([]);

      const result = await service.findAll({
        scope: 'class' as const,
        userId: 'u1',
      });

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should filter by status', async () => {
      mockInterviewRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ scope: 'all', userId: 'u1' }, 'draft');

      expect(interviewRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft' }),
        }),
      );
    });

    it('should filter by studentId', async () => {
      mockInterviewRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ scope: 'all', userId: 'u1' }, undefined, 's1');

      expect(interviewRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ studentId: 's1' }),
        }),
      );
    });

    it('should resolve student names via batchDecrypt', async () => {
      const piiMap = new Map<string, { name: string; studentNumber: string }>();
      piiMap.set('s1', { name: 'Alice', studentNumber: '001' });
      mockInterviewRepo.findAndCount.mockResolvedValue([
        [{ id: 'iv1', studentId: 's1' }],
        1,
      ]);
      mockUserRepo.find.mockResolvedValue([]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(piiMap);

      const result = await service.findAll({ scope: 'all', userId: 'u1' });

      expect(result.data[0].studentName).toBe('Alice');
    });
  });

  describe('findOne', () => {
    it('should return an interview by id', async () => {
      const interview = { id: 'iv1', status: 'draft' };
      mockInterviewRepo.findOne.mockResolvedValue(interview);

      const result = await service.findOne('iv1');

      expect(result).toEqual(interview);
    });

    it('should throw NotFoundException when not found', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should decrypt encryptedContent', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        encryptedContent: Buffer.from('enc'),
      });

      const result = await service.findOne('iv1');

      expect(encryptionService.decrypt).toHaveBeenCalled();
      expect((result as any).content).toBe('decrypted content');
    });

    it('should handle decrypt failure gracefully', async () => {
      mockEncryptionService.decrypt.mockRejectedValueOnce(new Error('fail'));
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        encryptedContent: Buffer.from('enc'),
      });

      const result = await service.findOne('iv1');

      expect((result as any).content).toBeNull();
    });

    it('should strip encryptedContent for class teacher', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        encryptedContent: Buffer.from('enc'),
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        roles: [{ name: 'teacher' }],
      });

      const result = await service.findOne('iv1', 'u1');

      expect((result as any).encryptedContent).toBeUndefined();
      expect((result as any).content).toBeUndefined();
    });

    it('should keep content for psychologist', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        encryptedContent: Buffer.from('enc'),
      });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        roles: [{ name: 'psychologist' }],
      });

      const result = await service.findOne('iv1', 'u1');

      expect((result as any).content).toBe('decrypted content');
    });
  });

  describe('update', () => {
    it('should update an interview', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });
      mockInterviewRepo.save.mockResolvedValue({
        id: 'iv1',
        status: 'reviewed',
      });

      const result = await service.update('iv1', { status: 'reviewed' });

      expect(interviewRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('reviewed');
    });

    it('should throw NotFoundException when updating non-existent', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { status: 'reviewed' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should encrypt content on update when provided', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });
      mockInterviewRepo.save.mockImplementation((d) => Promise.resolve(d));

      await service.update('iv1', { content: 'new secret' });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('new secret');
    });
  });

  describe('delete', () => {
    it('should delete an interview', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({ id: 'iv1' });

      await service.delete('iv1');

      expect(interviewRepo.remove).toHaveBeenCalledWith({ id: 'iv1' });
    });

    it('should throw NotFoundException when deleting non-existent', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addFile', () => {
    it('should add a file to an interview', async () => {
      mockFileRepo.save.mockResolvedValue({
        id: 'f1',
        interviewId: 'iv1',
        filePath: '/path',
        fileType: 'image',
      });

      const result = await service.addFile('iv1', '/path', 'image');

      expect(fileRepo.create).toHaveBeenCalledWith({
        interviewId: 'iv1',
        filePath: '/path',
        fileType: 'image',
      });
      expect(result.filePath).toBe('/path');
    });
  });

  describe('updateFileOcr', () => {
    it('should update file OCR result', async () => {
      mockFileRepo.findOne.mockResolvedValue({
        id: 'f1',
        ocrStatus: 'pending',
      });
      mockFileRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.updateFileOcr('f1', { text: 'ocr' }, 'done');

      expect(result.ocrResult).toEqual({ text: 'ocr' });
      expect(result.ocrStatus).toBe('done');
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateFileOcr('missing', {}, 'done'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFiles', () => {
    it('should return files for an interview', async () => {
      const files = [{ id: 'f1', interviewId: 'iv1' }];
      mockFileRepo.find.mockResolvedValue(files);

      const result = await service.getFiles('iv1');

      expect(result).toEqual(files);
    });
  });

  describe('create (enum validation)', () => {
    it('should reject invalid riskLevel', async () => {
      await expect(
        service.create({
          studentId: 's1',
          psychologistId: 'p1',
          interviewDate: '2024-01-01',
          riskLevel: 'extreme',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid status', async () => {
      await expect(
        service.create({
          studentId: 's1',
          psychologistId: 'p1',
          interviewDate: '2024-01-01',
          status: 'unknown',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid riskLevel', async () => {
      mockInterviewRepo.save.mockResolvedValue({
        id: 'iv1',
        riskLevel: 'warning',
      });

      await service.create({
        studentId: 's1',
        psychologistId: 'p1',
        interviewDate: '2024-01-01',
        riskLevel: 'warning',
      });

      expect(interviewRepo.save).toHaveBeenCalled();
    });
  });

  describe('update (riskLevel validation)', () => {
    it('should reject invalid riskLevel on update', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });

      await expect(
        service.update('iv1', { riskLevel: 'extreme' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should transition draft → reviewed', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });
      mockInterviewRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.updateStatus('iv1', 'reviewed');

      expect(result.status).toBe('reviewed');
    });

    it('should transition reviewed → completed', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'reviewed',
      });
      mockInterviewRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.updateStatus('iv1', 'completed');

      expect(result.status).toBe('completed');
    });

    it('should reject invalid transition draft → completed', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });

      await expect(service.updateStatus('iv1', 'completed')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject transition from completed', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'completed',
      });

      await expect(service.updateStatus('iv1', 'draft')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid status value', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({
        id: 'iv1',
        status: 'draft',
      });

      await expect(service.updateStatus('iv1', 'unknown')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when interview not found', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('missing', 'reviewed')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      mockFileRepo.findOne.mockResolvedValue({ id: 'f1', interviewId: 'iv1' });

      await service.deleteFile('f1');

      expect(fileRepo.remove).toHaveBeenCalledWith({
        id: 'f1',
        interviewId: 'iv1',
      });
    });

    it('should throw NotFoundException when file not found', async () => {
      mockFileRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteFile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject delete when file belongs to different interview', async () => {
      mockFileRepo.findOne.mockResolvedValue({
        id: 'f1',
        interviewId: 'iv2',
      });

      await expect(service.deleteFile('f1', 'iv1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow delete when interviewId matches', async () => {
      mockFileRepo.findOne.mockResolvedValue({
        id: 'f1',
        interviewId: 'iv1',
      });

      await service.deleteFile('f1', 'iv1');

      expect(fileRepo.remove).toHaveBeenCalled();
    });
  });

  describe('aggregateOcrText', () => {
    it('should aggregate OCR text from files', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({ id: 'iv1', ocrText: '' });
      mockFileRepo.find.mockResolvedValue([
        { ocrResult: { text: 'page 1' } },
        { ocrResult: { text: 'page 2' } },
      ]);
      mockInterviewRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.aggregateOcrText('iv1');

      expect(result.ocrText).toBe('page 1\npage 2');
    });

    it('should skip files without OCR text', async () => {
      mockInterviewRepo.findOne.mockResolvedValue({ id: 'iv1', ocrText: '' });
      mockFileRepo.find.mockResolvedValue([
        { ocrResult: { text: 'page 1' } },
        { ocrResult: null },
        { ocrResult: {} },
      ]);
      mockInterviewRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.aggregateOcrText('iv1');

      expect(result.ocrText).toBe('page 1');
    });

    it('should throw NotFoundException when interview not found', async () => {
      mockInterviewRepo.findOne.mockResolvedValue(null);

      await expect(service.aggregateOcrText('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
