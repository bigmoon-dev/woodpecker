/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Student } from '../../entities/org/student.entity';
import { DataRetentionService } from './data-retention.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let studentRepo: any;
  let configService: any;

  const mockStudentRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: getRepositoryToken(Student),
          useValue: mockStudentRepo,
        },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
    studentRepo = module.get(getRepositoryToken(Student));
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return 0 when no expired students', async () => {
    mockConfigService.get.mockReturnValue(365);
    mockStudentRepo.find.mockResolvedValueOnce([]);

    const result = await service.desensitizeExpired();

    expect(result).toBe(0);
    expect(studentRepo.save).not.toHaveBeenCalled();
  });

  it('should hash PII fields and save expired students', async () => {
    mockConfigService.get.mockReturnValue(30);
    const students = [
      {
        id: 's1',
        encryptedName: Buffer.from('Alice'),
        encryptedStudentNumber: Buffer.from('2024001'),
        encryptedContact: Buffer.from('13800000001'),
      },
      {
        id: 's2',
        encryptedName: Buffer.from('Bob'),
        encryptedStudentNumber: Buffer.from('2024002'),
        encryptedContact: Buffer.from('13800000002'),
      },
    ];
    mockStudentRepo.find.mockResolvedValueOnce(students);
    mockStudentRepo.save.mockImplementationOnce((s: any[]) =>
      Promise.resolve(s),
    );

    const result = await service.desensitizeExpired();

    expect(result).toBe(2);
    expect(studentRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 's1' }),
        expect.objectContaining({ id: 's2' }),
      ]),
    );

    const saved = mockStudentRepo.save.mock.calls[0][0] as any[];
    for (const s of saved) {
      expect(s.encryptedName).toBeInstanceOf(Buffer);
      expect(s.encryptedStudentNumber).toBeInstanceOf(Buffer);
      expect(s.encryptedContact).toBeInstanceOf(Buffer);
    }
  });

  it('should skip null PII fields without error', async () => {
    mockConfigService.get.mockReturnValue(365);
    const students = [
      {
        id: 's3',
        encryptedName: null,
        encryptedStudentNumber: null,
        encryptedContact: null,
      },
    ];
    mockStudentRepo.find.mockResolvedValueOnce(students);
    mockStudentRepo.save.mockImplementationOnce((s: any[]) =>
      Promise.resolve(s),
    );

    const result = await service.desensitizeExpired();

    expect(result).toBe(1);
    const saved = mockStudentRepo.save.mock.calls[0][0] as any[];
    expect(saved[0].encryptedName).toBeNull();
    expect(saved[0].encryptedStudentNumber).toBeNull();
    expect(saved[0].encryptedContact).toBeNull();
  });

  it('should mix null and non-null PII fields', async () => {
    mockConfigService.get.mockReturnValue(365);
    const students = [
      {
        id: 's4',
        encryptedName: Buffer.from('Charlie'),
        encryptedStudentNumber: null,
        encryptedContact: Buffer.from('13900001111'),
      },
    ];
    mockStudentRepo.find.mockResolvedValueOnce(students);
    mockStudentRepo.save.mockImplementationOnce((s: any[]) =>
      Promise.resolve(s),
    );

    const result = await service.desensitizeExpired();

    expect(result).toBe(1);
    const saved = mockStudentRepo.save.mock.calls[0][0] as any[];
    expect(saved[0].encryptedName).toBeInstanceOf(Buffer);
    expect(saved[0].encryptedStudentNumber).toBeNull();
    expect(saved[0].encryptedContact).toBeInstanceOf(Buffer);
  });

  it('should use default retention days when config not set', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    mockStudentRepo.find.mockResolvedValueOnce([]);

    await service.desensitizeExpired();

    expect(configService.get).toHaveBeenCalledWith('DATA_RETENTION_DAYS', 365);
  });

  it('should pass correct cutoff date to find query', async () => {
    mockConfigService.get.mockReturnValue(90);
    mockStudentRepo.find.mockResolvedValueOnce([]);

    await service.desensitizeExpired();

    const findArg = mockStudentRepo.find.mock.calls[0][0];
    expect(findArg.where).toBeDefined();
    expect(findArg.where.createdAt).toBeDefined();
  });
});
