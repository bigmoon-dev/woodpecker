/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  StudentProfileController,
  FollowupController,
} from './student-profile.controller';
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('StudentProfileController', () => {
  let controller: StudentProfileController;
  let service: StudentProfileService;

  const mockStudentRepo = { findOne: jest.fn() };
  const mockClassRepo = { findOne: jest.fn() };
  const mockGradeRepo = { findOne: jest.fn() };
  const mockAlertRepo = { find: jest.fn() };
  const mockHandlingRepo = { find: jest.fn() };
  const mockResultRepo = { find: jest.fn() };
  const mockAnswerRepo = { find: jest.fn() };
  const mockInterviewRepo = { find: jest.fn() };
  const mockFollowupRepo = { find: jest.fn() };
  const mockEncryptionService = {
    batchDecrypt: jest.fn().mockResolvedValue(new Map()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentProfileController],
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
        { provide: getRepositoryToken(User), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StudentProfileController>(StudentProfileController);
    service = module.get<StudentProfileService>(StudentProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return student profile', async () => {
      const mockProfile = {
        student: {
          id: 's1',
          name: '张三',
          gradeName: '三年级',
          className: '三年一班',
          gender: '男',
        },
        currentRiskLevel: 'yellow',
        lastAssessmentDate: null,
        assessmentHistory: [],
        interviewHistory: [],
        alertHistory: [],
        pendingFollowups: [],
        riskLevelSuggestion: null,
      };
      const getProfileSpy = jest
        .spyOn(service, 'getProfile')
        .mockResolvedValue(mockProfile as any);

      const result = await controller.getProfile('s1');

      expect(result).toEqual(mockProfile);
      expect(getProfileSpy).toHaveBeenCalledWith('s1');
    });
  });
});

describe('FollowupController', () => {
  let controller: FollowupController;
  let service: StudentProfileService;

  const mockRepos = {
    student: { findOne: jest.fn(), find: jest.fn() },
    class: { findOne: jest.fn() },
    grade: { findOne: jest.fn() },
    alert: { find: jest.fn() },
    handling: { find: jest.fn() },
    result: { find: jest.fn() },
    answer: { find: jest.fn() },
    interview: { find: jest.fn() },
    followup: { find: jest.fn() },
    user: { find: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowupController],
      providers: [
        StudentProfileService,
        {
          provide: getRepositoryToken(Student),
          useValue: mockRepos.student,
        },
        { provide: getRepositoryToken(Class), useValue: mockRepos.class },
        { provide: getRepositoryToken(Grade), useValue: mockRepos.grade },
        { provide: getRepositoryToken(AlertRecord), useValue: mockRepos.alert },
        {
          provide: getRepositoryToken(AlertHandlingRecord),
          useValue: mockRepos.handling,
        },
        {
          provide: getRepositoryToken(TaskResult),
          useValue: mockRepos.result,
        },
        {
          provide: getRepositoryToken(TaskAnswer),
          useValue: mockRepos.answer,
        },
        {
          provide: getRepositoryToken(Interview),
          useValue: mockRepos.interview,
        },
        {
          provide: getRepositoryToken(FollowUpReminder),
          useValue: mockRepos.followup,
        },
        { provide: getRepositoryToken(User), useValue: mockRepos.user },
        {
          provide: EncryptionService,
          useValue: { batchDecrypt: jest.fn().mockResolvedValue(new Map()) },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FollowupController>(FollowupController);
    service = module.get<StudentProfileService>(StudentProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPending', () => {
    it('should return pending followups', async () => {
      const mockData = [
        {
          id: 'f1',
          studentId: 's1',
          studentName: '张三',
          className: '三年一班',
          alertLevel: 'red',
          alertCreatedAt: new Date(),
          status: 'pending',
        },
      ];
      const getPendingSpy = jest
        .spyOn(service, 'getPendingFollowups')
        .mockResolvedValue(mockData as any);

      const result = await controller.getPending();

      expect(result).toEqual(mockData);
      expect(getPendingSpy).toHaveBeenCalled();
    });

    it('should return empty array when no followups', async () => {
      jest.spyOn(service, 'getPendingFollowups').mockResolvedValue([]);

      const result = await controller.getPending();

      expect(result).toEqual([]);
    });
  });
});
