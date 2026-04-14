/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentService } from './consent.service';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';

describe('ConsentService', () => {
  let service: ConsentService;
  let repo: any;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ ...d, id: 'rec-1' })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: getRepositoryToken(ConsentRecord), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);
    repo = module.get(getRepositoryToken(ConsentRecord));
  });

  it('should create and save a consent record', async () => {
    const data = {
      userId: 'u1',
      studentId: 's1',
      consentType: 'assessment',
      contentHash: 'abc123',
      signedAt: new Date(),
    };
    const result = await service.create(data);
    expect(repo.create).toHaveBeenCalledWith(data);
    expect(repo.save).toHaveBeenCalled();
    expect(result.id).toBe('rec-1');
  });

  it('should find consent records by userId sorted by signedAt DESC', async () => {
    const records = [{ id: 'r1' }, { id: 'r2' }];
    repo.find.mockResolvedValue(records);
    const result = await service.findByUserId('u1');
    expect(repo.find).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      order: { signedAt: 'DESC' },
    });
    expect(result).toEqual(records);
  });

  it('should return empty array when no records for userId', async () => {
    repo.find.mockResolvedValue([]);
    const result = await service.findByUserId('nonexistent');
    expect(result).toEqual([]);
  });

  it('should return true when consent record exists', async () => {
    repo.findOne.mockResolvedValue({ id: 'r1' });
    const result = await service.checkConsent('u1', 'assessment');
    expect(result).toBe(true);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { userId: 'u1', consentType: 'assessment' },
      order: { signedAt: 'DESC' },
    });
  });

  it('should return false when no consent record found', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.checkConsent('u1', 'assessment');
    expect(result).toBe(false);
  });

  it('should find a single consent record by id', async () => {
    const record = { id: 'r1', userId: 'u1' };
    repo.findOne.mockResolvedValue(record);
    const result = await service.findOne('r1');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(result).toEqual(record);
  });

  it('should return null when record not found by id', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.findOne('nonexistent');
    expect(result).toBeNull();
  });
});
