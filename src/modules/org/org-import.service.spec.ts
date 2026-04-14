/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import { OrgImportService } from './org-import.service';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Student } from '../../entities/org/student.entity';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { EncryptionService } from '../core/encryption.service';
import { DataSource } from 'typeorm';

describe('OrgImportService', () => {
  let service: OrgImportService;

  const mockStudentRepo = {
    find: jest.fn().mockResolvedValue([]),
  };
  const mockGradeRepo = {};
  const mockClassRepo = {};
  const mockEncryptionService = {
    encrypt: jest.fn().mockResolvedValue(Buffer.from('encrypted')),
  };
  const mockDataSource = {
    transaction: jest.fn((...args: any[]) => {
      const cb = args.length === 2 ? args[1] : args[0];
      const manager = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((_, data) => data),
        save: jest.fn().mockImplementation((_, entity) => {
          if (!entity.id) {
            entity.id = 'mock-uuid';
          }
          return Promise.resolve(entity);
        }),
      };
      return cb(manager);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        OrgImportService,
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(OrgImportService);
  });

  async function buildStudentExcel(rows: string[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('学生');
    sheet.addRow(['年级', '班级', '姓名', '学号', '联系方式', '性别']);
    for (const row of rows) {
      sheet.addRow(row);
    }
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  describe('validateFile', () => {
    it('should reject non-xlsx files', () => {
      const buf = Buffer.from('not an xlsx file content here');
      expect(() => service.validateFile(buf)).toThrow(BadRequestException);
    });

    it('should reject files exceeding 5MB', () => {
      const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const buf = Buffer.concat([header, Buffer.alloc(6 * 1024 * 1024)]);
      expect(() => service.validateFile(buf)).toThrow('文件大小超过 5MB 限制');
    });

    it('should accept valid xlsx files', () => {
      const buf = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.alloc(100),
      ]);
      expect(() => service.validateFile(buf)).not.toThrow();
    });
  });

  describe('parseExcel', () => {
    it('should parse valid student rows', async () => {
      mockStudentRepo.find.mockResolvedValue([]);
      const buffer = await buildStudentExcel([
        ['一年级', '1班', '张三', 'S001', '13800001111', '男'],
        ['一年级', '2班', '李四', 'S002', '', '女'],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.validRows).toHaveLength(2);
      expect(result.validRows[0].gradeName).toBe('一年级');
      expect(result.validRows[0].name).toBe('张三');
      expect(result.validRows[1].className).toBe('2班');
    });

    it('should trim whitespace from all fields', async () => {
      mockStudentRepo.find.mockResolvedValue([]);
      const buffer = await buildStudentExcel([
        ['  一年级  ', '  1班  ', '  张三  ', '  S001  ', '  138  ', '  男  '],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.validRows[0].gradeName).toBe('一年级');
      expect(result.validRows[0].className).toBe('1班');
      expect(result.validRows[0].name).toBe('张三');
      expect(result.validRows[0].studentNumber).toBe('S001');
    });

    it('should collect errors for rows missing required fields', async () => {
      const buffer = await buildStudentExcel([
        ['', '1班', '张三', 'S001', '', ''],
        ['一年级', '', '李四', 'S002', '', ''],
        ['一年级', '1班', '', 'S003', '', ''],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].field).toBe('gradeName');
      expect(result.errors[1].field).toBe('className');
      expect(result.errors[2].field).toBe('name');
    });

    it('should deduplicate student numbers within the file', async () => {
      mockStudentRepo.find.mockResolvedValue([]);
      const buffer = await buildStudentExcel([
        ['一年级', '1班', '张三', 'S001', '', ''],
        ['一年级', '2班', '李四', 'S001', '', ''],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.validRows).toHaveLength(1);
      expect(result.validRows[0].name).toBe('张三');
    });

    it('should skip students with existing studentNumberHash', async () => {
      const hash = crypto.createHash('sha256').update('S001').digest('hex');
      mockStudentRepo.find.mockResolvedValue([{ studentNumberHash: hash }]);

      const buffer = await buildStudentExcel([
        ['一年级', '1班', '张三', 'S001', '', ''],
        ['一年级', '2班', '李四', 'S002', '', ''],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.validRows).toHaveLength(1);
      expect(result.validRows[0].name).toBe('李四');
    });

    it('should allow rows without student number', async () => {
      mockStudentRepo.find.mockResolvedValue([]);
      const buffer = await buildStudentExcel([
        ['一年级', '1班', '张三', '', '', ''],
        ['一年级', '2班', '李四', '', '', ''],
      ]);

      const result = await service.parseExcel(buffer);
      expect(result.validRows).toHaveLength(2);
    });

    it('should throw on empty file with no data rows', async () => {
      const buffer = await buildStudentExcel([]);
      await expect(service.parseExcel(buffer)).rejects.toThrow(
        'Excel 文件没有数据行',
      );
    });
  });

  describe('importStudents', () => {
    it('should return empty result for empty rows', async () => {
      const result = await service.importStudents([]);
      expect(result).toEqual({
        total: 0,
        created: 0,
        skipped: 0,
        errors: [],
      });
    });

    it('should create grade/class/student in a transaction', async () => {
      const result = await service.importStudents([
        {
          gradeName: '一年级',
          className: '1班',
          name: '张三',
          studentNumber: 'S001',
          contact: '13800001111',
          gender: '男',
        },
      ]);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.created).toBe(1);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('张三');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('S001');
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('13800001111');
    });

    it('should compute studentNumberHash via SHA-256', async () => {
      let savedStudent: any = null;
      mockDataSource.transaction.mockImplementationOnce((...args: any[]) => {
        const cb = args.length === 2 ? args[1] : args[0];
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn((_, data) => data),
          save: jest.fn().mockImplementation((cls, entity) => {
            if (cls === Student) savedStudent = entity;
            entity.id = 'mock-uuid';
            return Promise.resolve(entity);
          }),
        };
        return cb(manager);
      });

      await service.importStudents([
        {
          gradeName: '一年级',
          className: '1班',
          name: '张三',
          studentNumber: 'S001',
          contact: '',
          gender: '',
        },
      ]);

      const expected = crypto.createHash('sha256').update('S001').digest('hex');
      expect(savedStudent.studentNumberHash).toBe(expected);
    });
  });

  describe('generateTemplate', () => {
    it('should return a valid xlsx buffer with headers', async () => {
      const buffer = await service.generateTemplate();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(0x50);
      expect(buffer[1]).toBe(0x4b);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = workbook.worksheets[0];
      expect(sheet).toBeDefined();
      expect(sheet.getRow(1).getCell(1).value).toBe('年级');
      expect(sheet.getRow(1).getCell(3).value).toBe('姓名');
    });
  });
});
