/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrgService } from './org.service';
import { Grade } from '../../entities/org/grade.entity';
import { Class } from '../../entities/org/class.entity';
import { Student } from '../../entities/org/student.entity';
import { HookBus } from '../plugin/hook-bus';
import { DataScopeFilter } from '../auth/data-scope-filter';

describe('OrgService Hook emit', () => {
  let service: OrgService;
  let hookBus: any;

  const mockGradeRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'g1' })),
  };
  const mockClassRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'c1' })),
  };
  const mockStudentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 's1' })),
    findAndCount: jest.fn(),
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
      ],
    }).compile();

    service = module.get<OrgService>(OrgService);
    hookBus = module.get(HookBus);
  });

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
