/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OrgService } from './org.service';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter } from '../auth/data-scope-filter';
import { EncryptionService } from '../core/encryption.service';

describe('OrgService', () => {
  let service: OrgService;
  let hookBus: any;
  let gradeRepo: any;
  let classRepo: any;
  let studentRepo: any;
  let dataScopeFilter: any;

  const mockGradeRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'g1' })),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const mockClassRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'c1' })),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const mockStudentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 's1' })),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const mockHookBus = { emit: jest.fn().mockResolvedValue(undefined) };
  const mockDataScopeFilter = {
    getStudentIds: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgService,
        { provide: getRepositoryToken(Grade), useValue: mockGradeRepo },
        { provide: getRepositoryToken(Class), useValue: mockClassRepo },
        { provide: getRepositoryToken(Student), useValue: mockStudentRepo },
        { provide: HookBus, useValue: mockHookBus },
        { provide: DataScopeFilter, useValue: mockDataScopeFilter },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn().mockResolvedValue(Buffer.from('enc')),
          },
        },
      ],
    }).compile();

    service = module.get<OrgService>(OrgService);
    hookBus = module.get(HookBus);
    gradeRepo = module.get(getRepositoryToken(Grade));
    classRepo = module.get(getRepositoryToken(Class));
    studentRepo = module.get(getRepositoryToken(Student));
    dataScopeFilter = module.get(DataScopeFilter);
  });

  describe('createStudent hook', () => {
    it('should emit on:student.imported after createStudent', async () => {
      mockStudentRepo.save.mockResolvedValueOnce({ id: 's1', classId: 'c1' });
      await service.createStudent({ classId: 'c1' });
      expect(hookBus.emit).toHaveBeenCalledWith(
        'on:student.imported',
        expect.objectContaining({ studentId: 's1', classId: 'c1' }),
      );
    });

    it('should not throw when hook emit fails', async () => {
      mockStudentRepo.save.mockResolvedValueOnce({ id: 's1', classId: 'c1' });
      mockHookBus.emit.mockRejectedValueOnce(new Error('hook failed'));
      await expect(
        service.createStudent({ classId: 'c1' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findAllGrades', () => {
    it('should paginate directly for scope=all', async () => {
      mockGradeRepo.findAndCount.mockResolvedValueOnce([
        [{ id: 'g1', name: 'Grade1' }],
        1,
      ]);
      const result = await service.findAllGrades(
        { scope: 'all', userId: 'u1' },
        1,
        20,
      );
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty when no studentIds for scoped query', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValueOnce([]);
      const result = await service.findAllGrades({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('should resolve student-class-grade chain for scoped query', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValueOnce(['s1']);
      mockStudentRepo.find.mockResolvedValueOnce([{ id: 's1', classId: 'c1' }]);
      mockClassRepo.find.mockResolvedValueOnce([{ id: 'c1', gradeId: 'g1' }]);
      mockGradeRepo.findAndCount.mockResolvedValueOnce([
        [{ id: 'g1', name: 'Grade1' }],
        1,
      ]);
      const result = await service.findAllGrades({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOneGrade', () => {
    it('should return grade with classes', async () => {
      mockGradeRepo.findOne.mockResolvedValue({
        id: 'g1',
        name: 'Grade1',
        classes: [],
      });
      const grade = await service.findOneGrade('g1');
      expect(grade.name).toBe('Grade1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockGradeRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneGrade('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateGrade', () => {
    it('should update and save', async () => {
      mockGradeRepo.findOne.mockResolvedValue({ id: 'g1', name: 'Old' });
      mockGradeRepo.save.mockImplementation((d: any) => Promise.resolve(d));
      const result = await service.updateGrade('g1', { name: 'New' });
      expect(result.name).toBe('New');
    });

    it('should throw NotFoundException when not found', async () => {
      mockGradeRepo.findOne.mockResolvedValue(null);
      await expect(service.updateGrade('x', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeGrade', () => {
    it('should call delete', async () => {
      await service.removeGrade('g1');
      expect(gradeRepo.delete).toHaveBeenCalledWith('g1');
    });
  });

  describe('findAllClasses', () => {
    it('should filter by gradeId', async () => {
      mockClassRepo.findAndCount.mockResolvedValueOnce([
        [{ id: 'c1', name: 'Class1', gradeId: 'g1' }],
        1,
      ]);
      const result = await service.findAllClasses(
        { scope: 'all', userId: 'u1' },
        'g1',
      );
      expect(result.data).toHaveLength(1);
    });

    it('should return empty for scoped with no students', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValueOnce([]);
      const result = await service.findAllClasses({
        scope: 'class',
        userId: 'u1',
        classId: 'c1',
      });
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findOneClass', () => {
    it('should throw NotFoundException when not found', async () => {
      mockClassRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneClass('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateClass', () => {
    it('should throw NotFoundException when not found', async () => {
      mockClassRepo.findOne.mockResolvedValue(null);
      await expect(service.updateClass('x', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllStudents', () => {
    it('should filter by classId', async () => {
      mockStudentRepo.findAndCount.mockResolvedValueOnce([
        [{ id: 's1', classId: 'c1' }],
        1,
      ]);
      const result = await service.findAllStudents(
        { scope: 'all', userId: 'u1' },
        'c1',
      );
      expect(result.data).toHaveLength(1);
    });

    it('should return empty for scoped with no students', async () => {
      mockDataScopeFilter.getStudentIds.mockResolvedValueOnce([]);
      const result = await service.findAllStudents({
        scope: 'grade',
        userId: 'u1',
        gradeId: 'g1',
      });
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  describe('findOneStudent', () => {
    it('should throw NotFoundException when not found', async () => {
      mockStudentRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneStudent('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStudent', () => {
    it('should throw NotFoundException when not found', async () => {
      mockStudentRepo.findOne.mockResolvedValue(null);
      await expect(service.updateStudent('x', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
