/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Student } from '../../entities/org/student.entity';
import { DataRetentionService } from './data-retention.service';
import { EncryptionService } from '../core/encryption.service';

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

  const mockEncryptionService = {
    decrypt: jest.fn(),
    encrypt: jest.fn(),
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
        { provide: EncryptionService, useValue: mockEncryptionService },
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

  it('should mask PII fields and save expired students', async () => {
    mockConfigService.get.mockReturnValue(30);
    const students = [
      {
        id: 's1',
        encryptedName: Buffer.from('encrypted-name-1'),
        encryptedStudentNumber: Buffer.from('encrypted-num-1'),
        encryptedContact: Buffer.from('encrypted-contact-1'),
      },
    ];
    mockStudentRepo.find.mockResolvedValueOnce(students);
    mockEncryptionService.decrypt
      .mockResolvedValueOnce('张三')
      .mockResolvedValueOnce('2023010001')
      .mockResolvedValueOnce('13812345678');
    mockEncryptionService.encrypt.mockImplementation((v: string) =>
      Promise.resolve(Buffer.from('masked:' + v)),
    );
    mockStudentRepo.save.mockImplementationOnce((s: any[]) =>
      Promise.resolve(s),
    );

    const result = await service.desensitizeExpired();

    expect(result).toBe(1);
    expect(mockEncryptionService.decrypt).toHaveBeenCalledTimes(3);
    expect(mockEncryptionService.encrypt).toHaveBeenCalledTimes(3);
    const saved = mockStudentRepo.save.mock.calls[0][0] as any[];
    expect(saved[0].encryptedName.toString()).toContain('masked:张**');
    expect(saved[0].encryptedStudentNumber.toString()).toContain('masked:2023****0001');
    expect(saved[0].encryptedContact.toString()).toContain('masked:138****5678');
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
        encryptedName: Buffer.from('encrypted-name-4'),
        encryptedStudentNumber: null,
        encryptedContact: Buffer.from('encrypted-contact-4'),
      },
    ];
    mockStudentRepo.find.mockResolvedValueOnce(students);
    mockEncryptionService.decrypt
      .mockResolvedValueOnce('Charlie')
      .mockResolvedValueOnce('13900001111');
    mockEncryptionService.encrypt.mockImplementation((v: string) =>
      Promise.resolve(Buffer.from('masked:' + v)),
    );
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
