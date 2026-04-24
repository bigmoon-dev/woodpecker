/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { StudentProfileService } from './student-profile.service';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { AlertHandlingRecord } from '../../entities/audit/alert-handling-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Interview } from '../../entities/interview/interview.entity';
import { FollowUpReminder } from '../../entities/interview/follow-up-reminder.entity';
import { User } from '../../entities/auth/user.entity';
import { EncryptionService } from '../core/encryption.service';

describe('StudentProfileService', () => {
  let service: StudentProfileService;

  const mockStudentRepo = { findOne: jest.fn(), find: jest.fn() };
  const mockClassRepo = { findOne: jest.fn() };
  const mockGradeRepo = { findOne: jest.fn() };
  const mockAlertRepo = { find: jest.fn() };
  const mockHandlingRepo = { find: jest.fn() };
  const mockResultRepo = { find: jest.fn() };
  const mockAnswerRepo = { find: jest.fn() };
  const mockInterviewRepo = { find: jest.fn() };
  const mockFollowupRepo = { find: jest.fn() };
  const mockUserRepo = { find: jest.fn() };
  const mockEncryptionService = {
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentProfileService,
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: getRepositoryToken(AlertRecord), useValue: mockAlertRepo },
        {
          provide: getRepositoryToken(AlertHandlingRecord),
          useValue: mockHandlingRepo,
        },
        { provide: getRepositoryToken(TaskResult), useValue: mockResultRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: mockAnswerRepo },
        {
          provide: getRepositoryToken(Interview),
          useValue: mockInterviewRepo,
        },
        {
          provide: getRepositoryToken(FollowUpReminder),
          useValue: mockFollowupRepo,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<StudentProfileService>(StudentProfileService);
  });

  describe('getProfile', () => {
    const baseStudent = {
      id: '00000000-0000-0000-0000-000000000001',
      gender: '男',
      class: { id: 'c1', name: '三年一班', gradeId: 'g1' },
    };

    it('should throw NotFoundException when student not found', async () => {
      mockStudentRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('not-a-valid-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return full profile with all data', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([
          [
            '00000000-0000-0000-0000-000000000001',
            { name: '张三', studentNumber: '001' },
          ],
        ]),
      );
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          level: 'red',
          studentId: '00000000-0000-0000-0000-000000000001',
          createdAt: new Date(),
        },
      ]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);
      mockHandlingRepo.find.mockResolvedValue([]);
      mockResultRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.student.name).toBe('张三');
      expect(result.student.gradeName).toBe('三年级');
      expect(result.student.className).toBe('三年一班');
      expect(result.alertHistory).toHaveLength(1);
    });

    it('should resolve results through answerRepo → resultRepo chain', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'ans1' }, { id: 'ans2' }]);
      mockResultRepo.find.mockResolvedValue([
        { id: 'r1', answerId: 'ans1', color: 'green', createdAt: new Date() },
      ]);
      mockHandlingRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(mockAnswerRepo.find).toHaveBeenCalledWith({
        where: { studentId: '00000000-0000-0000-0000-000000000001' },
      });
      expect(mockResultRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ answerId: 'ans1' }, { answerId: 'ans2' }],
        }),
      );
      expect(result.assessmentHistory).toHaveLength(1);
    });

    it('should not query results when no answers exist', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(mockResultRepo.find).not.toHaveBeenCalled();
      expect(result.assessmentHistory).toEqual([]);
    });

    it('should return currentRiskLevel from latest alert', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          level: 'yellow',
          studentId: '00000000-0000-0000-0000-000000000001',
          createdAt: new Date(),
        },
      ]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);
      mockHandlingRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.currentRiskLevel).toBe('yellow');
    });

    it('should return null currentRiskLevel when no alerts', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.currentRiskLevel).toBeNull();
    });

    it('should return lastAssessmentDate from latest result', async () => {
      const date = new Date('2024-06-01');
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'ans1' }]);
      mockResultRepo.find.mockResolvedValue([
        { id: 'r1', answerId: 'ans1', createdAt: date },
      ]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.lastAssessmentDate).toEqual(date);
    });

    it('should include handling history for each alert', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          level: 'red',
          studentId: '00000000-0000-0000-0000-000000000001',
          createdAt: new Date(),
        },
      ]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);
      mockHandlingRepo.find.mockResolvedValue([
        { alertId: 'a1', action: 'handle', note: 'test' },
      ]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.alertHistory[0].handlingHistory).toHaveLength(1);
      expect(result.alertHistory[0].handlingHistory[0].action).toBe('handle');
    });

    it('should return riskLevelSuggestion when color changed', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          level: 'red',
          studentId: '00000000-0000-0000-0000-000000000001',
          createdAt: new Date(),
        },
      ]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'ans1' }, { id: 'ans2' }]);
      mockResultRepo.find.mockResolvedValue([
        {
          id: 'r1',
          answerId: 'ans1',
          color: 'green',
          createdAt: new Date(),
        },
        {
          id: 'r2',
          answerId: 'ans2',
          color: 'red',
          createdAt: new Date('2024-01-01'),
        },
      ]);
      mockHandlingRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.riskLevelSuggestion).toEqual({
        suggestedLevel: 'green',
        basedOnResultId: 'r1',
        previousLevel: 'red',
      });
    });

    it('should not return riskLevelSuggestion when color matches current level', async () => {
      mockStudentRepo.findOne.mockResolvedValue(baseStudent);
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: '三年级' });
      mockAlertRepo.find.mockResolvedValue([
        {
          id: 'a1',
          level: 'red',
          studentId: '00000000-0000-0000-0000-000000000001',
          createdAt: new Date(),
        },
      ]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([{ id: 'ans1' }, { id: 'ans2' }]);
      mockResultRepo.find.mockResolvedValue([
        {
          id: 'r1',
          answerId: 'ans1',
          color: 'red',
          createdAt: new Date(),
        },
        {
          id: 'r2',
          answerId: 'ans2',
          color: 'yellow',
          createdAt: new Date('2024-01-01'),
        },
      ]);
      mockHandlingRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.riskLevelSuggestion).toBeNull();
    });

    it('should handle student without class gracefully', async () => {
      mockStudentRepo.findOne.mockResolvedValue({
        id: 's1',
        gender: null,
        class: null,
      });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.student.gradeName).toBe('');
      expect(result.student.className).toBe('');
    });

    it('should handle class without gradeId gracefully', async () => {
      mockStudentRepo.findOne.mockResolvedValue({
        id: 's1',
        gender: null,
        class: { id: 'c1', name: '三年一班' },
      });
      mockAlertRepo.find.mockResolvedValue([]);
      mockInterviewRepo.find.mockResolvedValue([]);
      mockFollowupRepo.find.mockResolvedValue([]);
      mockAnswerRepo.find.mockResolvedValue([]);

      const result = await service.getProfile(
        '00000000-0000-0000-0000-000000000001',
      );

      expect(result.student.gradeName).toBe('');
      expect(result.student.className).toBe('三年一班');
    });
  });

  describe('getPendingFollowups', () => {
    it('should return empty array when no followups', async () => {
      mockFollowupRepo.find.mockResolvedValue([]);

      const result = await service.getPendingFollowups();

      expect(result).toEqual([]);
    });

    it('should return followups with student info and alert level', async () => {
      mockFollowupRepo.find.mockResolvedValue([
        {
          id: 'f1',
          studentId: '00000000-0000-0000-0000-000000000001',
          interviewId: null,
          completed: false,
          createdAt: new Date(),
        },
      ]);
      mockUserRepo.find.mockResolvedValue([]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(
        new Map([
          [
            '00000000-0000-0000-0000-000000000001',
            { name: '张三', studentNumber: '001' },
          ],
        ]),
      );
      mockStudentRepo.find.mockResolvedValue([
        {
          id: '00000000-0000-0000-0000-000000000001',
          class: { name: '三年一班' },
        },
      ]);
      mockAlertRepo.find.mockResolvedValue([
        {
          studentId: '00000000-0000-0000-0000-000000000001',
          level: 'red',
          status: 'followup',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getPendingFollowups();

      expect(result).toHaveLength(1);
      expect(result[0].studentName).toBe('张三');
      expect(result[0].className).toBe('三年一班');
      expect(result[0].alertLevel).toBe('red');
      expect(result[0].status).toBe('followup');
    });

    it('should set status to interviewed when followup has interviewId', async () => {
      mockFollowupRepo.find.mockResolvedValue([
        {
          id: 'f1',
          studentId: '00000000-0000-0000-0000-000000000001',
          interviewId: 'iv1',
          completed: false,
          createdAt: new Date(),
        },
      ]);
      mockUserRepo.find.mockResolvedValue([]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      mockStudentRepo.find.mockResolvedValue([
        { id: '00000000-0000-0000-0000-000000000001', class: null },
      ]);
      mockAlertRepo.find.mockResolvedValue([
        {
          studentId: '00000000-0000-0000-0000-000000000001',
          level: 'yellow',
          status: 'handled',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getPendingFollowups();

      expect(result[0].status).toBe('interviewed');
    });

    it('should set status to pending when no interview and alert not followup', async () => {
      mockFollowupRepo.find.mockResolvedValue([
        {
          id: 'f1',
          studentId: '00000000-0000-0000-0000-000000000001',
          interviewId: null,
          completed: false,
          createdAt: new Date(),
        },
      ]);
      mockUserRepo.find.mockResolvedValue([]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      mockStudentRepo.find.mockResolvedValue([
        { id: '00000000-0000-0000-0000-000000000001', class: null },
      ]);
      mockAlertRepo.find.mockResolvedValue([
        {
          studentId: '00000000-0000-0000-0000-000000000001',
          level: 'yellow',
          status: 'handled',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getPendingFollowups();

      expect(result[0].status).toBe('pending');
    });

    it('should deduplicate studentIds for batch queries', async () => {
      mockFollowupRepo.find.mockResolvedValue([
        {
          id: 'f1',
          studentId: '00000000-0000-0000-0000-000000000001',
          completed: false,
          createdAt: new Date(),
        },
        {
          id: 'f2',
          studentId: '00000000-0000-0000-0000-000000000001',
          completed: false,
          createdAt: new Date(),
        },
        {
          id: 'f3',
          studentId: '00000000-0000-0000-0000-000000000002',
          completed: false,
          createdAt: new Date(),
        },
      ]);
      mockUserRepo.find.mockResolvedValue([]);
      mockEncryptionService.batchDecrypt.mockResolvedValue(new Map());
      mockStudentRepo.find.mockResolvedValue([]);
      mockAlertRepo.find.mockResolvedValue([]);

      await service.getPendingFollowups();

      const decryptCall = mockEncryptionService.batchDecrypt.mock
        .calls[0][0] as string[];
      expect(decryptCall).toEqual([
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ]);
    });
  });
});
