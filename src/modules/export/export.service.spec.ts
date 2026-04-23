/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ExportService } from './export.service';
import { AlertRecord } from '../../entities/audit/alert-record.entity';
import { TaskResult } from '../../entities/task/task-result.entity';
import { TaskAnswer } from '../../entities/task/task-answer.entity';
import { Student } from '../../entities/org/student.entity';
import { Class } from '../../entities/org/class.entity';
import { Grade } from '../../entities/org/grade.entity';
import { User } from '../../entities/auth/user.entity';
import { EncryptionService } from '../core/encryption.service';
import { ResultWithContext } from '../result/result.service';

jest.mock('pdfkit', () => {
  const createMockDoc = () => {
    const doc: any = {
      registerFont: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event: string, handler: any) => {
        if (event === 'data') doc._dataHandler = handler;
        if (event === 'end') doc._endHandler = handler;
        return doc;
      }),
      end: jest.fn().mockImplementation(() => {
        if (doc._dataHandler) doc._dataHandler(Buffer.from('pdf'));
        if (doc._endHandler) doc._endHandler(undefined);
      }),
      _dataHandler: null,
      _endHandler: null,
    };
    return doc;
  };

  const fn = function () {
    return createMockDoc();
  };
  Object.assign(fn, { __esModule: true, default: fn });
  return fn;
});

describe('ExportService', () => {
  let service: ExportService;
  let alertRepo: any;
  let resultRepo: any;
  let answerRepo: any;
  let studentRepo: any;
  let encryptionService: any;

  const mockAlertRepo = { find: jest.fn() };
  const mockResultRepo = { findOne: jest.fn() };
  const mockAnswerRepo = { findOne: jest.fn() };
  const mockStudentRepo = { findOne: jest.fn() };
  const mockClassRepo = { find: jest.fn() };
  const mockGradeRepo = { find: jest.fn() };
  const mockUserRepo = { findOne: jest.fn() };
  const mockEncryption = { batchDecrypt: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(AlertRecord), useValue: mockAlertRepo },
        { provide: getRepositoryToken(TaskResult), useValue: mockResultRepo },
        { provide: getRepositoryToken(TaskAnswer), useValue: mockAnswerRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: EncryptionService, useValue: mockEncryption },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
    alertRepo = module.get(getRepositoryToken(AlertRecord));
    resultRepo = module.get(getRepositoryToken(TaskResult));
    answerRepo = module.get(getRepositoryToken(TaskAnswer));
    studentRepo = module.get(getRepositoryToken(Student));
    encryptionService = module.get(EncryptionService);
  });

  describe('generateExcel', () => {
    const makeResult = (i: number): ResultWithContext => ({
      result: {
        id: `r${i}`,
        totalScore: i * 10,
        level: 'normal',
        color: 'green',
        dimensionScores: { dim1: i },
        createdAt: new Date('2026-01-01'),
        suggestion: 'ok',
      } as any,
      studentId: `s${i}`,
      studentName: `Student${i}`,
      studentNumber: `00${i}`,
      className: 'Class1',
      gradeName: 'Grade1',
      scaleName: 'SCL-90',
      taskTitle: 'Task1',
    });

    it('should generate Excel buffer with results', async () => {
      mockAlertRepo.find.mockResolvedValue([]);
      const buf = await service.generateExcel([makeResult(1), makeResult(2)]);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('should include alert detail sheet when alerts exist', async () => {
      mockAlertRepo.find.mockResolvedValue([
        {
          resultId: 'r1',
          level: 'red',
          status: 'pending',
          handledById: null,
          handledAt: null,
          handleNote: null,
        },
      ]);
      const buf = await service.generateExcel([makeResult(1)]);
      expect(buf).toBeInstanceOf(Buffer);
      expect(mockAlertRepo.find).toHaveBeenCalled();
    });

    it('should skip alert sheet when no alerts', async () => {
      mockAlertRepo.find.mockResolvedValue([]);
      const buf = await service.generateExcel([makeResult(1)]);
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('should handle empty results', async () => {
      const buf = await service.generateExcel([]);
      expect(buf).toBeInstanceOf(Buffer);
      expect(alertRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('generatePdf', () => {
    it('should throw NotFoundException for missing result', async () => {
      mockResultRepo.findOne.mockResolvedValue(null);
      await expect(service.generatePdf('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should generate PDF buffer for existing result', async () => {
      mockResultRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalScore: 85,
        level: 'normal',
        color: 'green',
        dimensionScores: { anxiety: 20 },
        suggestion: 'Monitor',
        answerId: 'a1',
        createdAt: new Date('2026-01-01'),
      });
      mockAnswerRepo.findOne.mockResolvedValue({
        studentId: 'user1',
        task: { title: 'Task1', scale: { name: 'SCL-90' } },
      });
      mockUserRepo.findOne.mockResolvedValue({ id: 'user1', studentId: 's1' });
      mockEncryption.batchDecrypt.mockResolvedValue(
        new Map([['s1', { name: 'Alice', studentNumber: '001' }]]),
      );
      mockStudentRepo.findOne.mockResolvedValue({
        class: { name: 'Class1', grade: { name: 'Grade1' } },
      });
      const buf = await service.generatePdf('r1');
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    it('should handle result with no studentId', async () => {
      mockResultRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalScore: 50,
        level: 'normal',
        color: 'green',
        createdAt: new Date('2026-01-01'),
      });
      mockAnswerRepo.findOne.mockResolvedValue({
        studentId: '',
        task: { title: 'T', scale: { name: 'S' } },
      });
      const buf = await service.generatePdf('r1');
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('should include dimension section when dimensionScores exist', async () => {
      mockResultRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalScore: 50,
        level: 'mild',
        color: 'yellow',
        dimensionScores: { anxiety: 25, depression: 15 },
        answerId: 'a1',
        createdAt: new Date('2026-01-01'),
      });
      mockAnswerRepo.findOne.mockResolvedValue({
        studentId: 'user1',
        task: { title: 'T', scale: { name: 'S' } },
      });
      mockUserRepo.findOne.mockResolvedValue({ id: 'user1', studentId: null });
      const buf = await service.generatePdf('r1');
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('should include suggestion section when suggestion exists', async () => {
      mockResultRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalScore: 90,
        level: 'severe',
        color: 'red',
        suggestion: 'Seek professional help immediately',
        answerId: 'a1',
        createdAt: new Date('2026-01-01'),
      });
      mockAnswerRepo.findOne.mockResolvedValue({
        studentId: 'user1',
        task: { title: 'T', scale: { name: 'S' } },
      });
      mockUserRepo.findOne.mockResolvedValue({ id: 'user1', studentId: null });
      const buf = await service.generatePdf('r1');
      expect(buf).toBeInstanceOf(Buffer);
    });

    it('should handle result with null suggestion and no dimensions', async () => {
      mockResultRepo.findOne.mockResolvedValue({
        id: 'r1',
        totalScore: 10,
        level: 'normal',
        color: 'green',
        dimensionScores: null,
        suggestion: null,
        createdAt: new Date('2026-01-01'),
      });
      mockAnswerRepo.findOne.mockResolvedValue({
        studentId: '',
        task: { title: 'T', scale: { name: 'S' } },
      });
      const buf = await service.generatePdf('r1');
      expect(buf).toBeInstanceOf(Buffer);
    });
  });
});
