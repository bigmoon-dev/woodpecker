/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FollowUpService } from './follow-up.service';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { User } from '../../entities/auth/user.entity';
import { EncryptionService } from '../core/encryption.service';

describe('FollowUpService', () => {
  let service: FollowUpService;
  let reminderRepo: any;

  const mockReminderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: d.id || 'r1' })),
  };

  const mockUserRepo = {
    find: jest.fn(),
  };

  const mockEncryptionService = {
    batchDecrypt: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        {
          provide: getRepositoryToken(FollowUpReminder),
          useValue: mockReminderRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<FollowUpService>(FollowUpService);
    reminderRepo = module.get(getRepositoryToken(FollowUpReminder));
  });

  describe('create', () => {
    it('should create a follow-up reminder', async () => {
      const dto = {
        interviewId: 'iv1',
        studentId: 's1',
        reminderDate: '2024-02-01',
      };
      mockReminderRepo.save.mockResolvedValue({ ...dto, id: 'r1' });

      const result = await service.create(dto);

      expect(reminderRepo.create).toHaveBeenCalled();
      expect(result.id).toBe('r1');
    });

    it('should convert reminderDate string to Date', async () => {
      const dto = {
        interviewId: 'iv1',
        studentId: 's1',
        reminderDate: '2024-02-01',
      };
      mockReminderRepo.save.mockResolvedValue({ ...dto, id: 'r1' });

      await service.create(dto);

      const created = reminderRepo.create.mock.calls[0][0];
      expect(created.reminderDate).toBeInstanceOf(Date);
    });
  });

  describe('findByStudent', () => {
    it('should return reminders for a student', async () => {
      const reminders = [{ id: 'r1', studentId: 's1' }];
      mockReminderRepo.find.mockResolvedValue(reminders);

      const result = await service.findByStudent('s1');

      expect(result).toEqual(reminders);
      expect(reminderRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' } }),
      );
    });
  });

  describe('markComplete', () => {
    it('should mark a reminder as complete', async () => {
      const reminder = { id: 'r1', completed: false };
      mockReminderRepo.findOne.mockResolvedValue(reminder);
      mockReminderRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.markComplete('r1');

      expect(result.completed).toBe(true);
      expect(reminderRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when reminder not found', async () => {
      mockReminderRepo.findOne.mockResolvedValue(null);

      await expect(service.markComplete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPending', () => {
    it('should return pending reminders with studentName', async () => {
      const pending = [{ id: 'r1', completed: false, studentId: 'u1' }];
      mockReminderRepo.find.mockResolvedValue(pending);
      mockUserRepo.find.mockResolvedValue([{ id: 'u1', studentId: 's1' }]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: '张三', studentNumber: 'S001' }]]),
      );

      const result = await service.findPending();

      expect(result[0].studentName).toBe('张三');
      expect(mockEncryptionService.batchDecrypt).toHaveBeenCalledWith(['s1']);
    });

    it('should handle empty studentIds', async () => {
      const pending = [{ id: 'r1', completed: false, studentId: null }];
      mockReminderRepo.find.mockResolvedValue(pending);

      const result = await service.findPending();

      expect(result[0].studentName).toBe('');
    });
  });
});
