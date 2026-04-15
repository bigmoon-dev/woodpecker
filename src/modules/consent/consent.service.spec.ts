/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentService } from './consent.service';
import { ConsentRecord } from '../../entities/consent/consent-record.entity';

describe('ConsentService', () => {
  let service: ConsentService;
  let consentRepo: any;

  const mockConsentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ ...d, id: 'cr1' })),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        {
          provide: getRepositoryToken(ConsentRecord),
          useValue: mockConsentRepo,
        },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);
    consentRepo = module.get(getRepositoryToken(ConsentRecord));
  });

  describe('create', () => {
    it('should create a consent record', async () => {
      const data = { userId: 'u1', consentType: 'assessment', signedAt: new Date() };
      mockConsentRepo.save.mockResolvedValue({ ...data, id: 'cr1' });

      const result = await service.create(data);

      expect(consentRepo.create).toHaveBeenCalledWith(data);
      expect(result.id).toBe('cr1');
    });
  });

  describe('findByUserId', () => {
    it('should find records by userId', async () => {
      const records = [{ id: 'cr1', userId: 'u1' }];
      mockConsentRepo.find.mockResolvedValue(records);

      const result = await service.findByUserId('u1');

      expect(consentRepo.find).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        order: { signedAt: 'DESC' },
      });
      expect(result).toEqual(records);
    });
  });

  describe('checkConsent', () => {
    it('should return true when consent exists', async () => {
      mockConsentRepo.findOne.mockResolvedValue({
        id: 'cr1',
        userId: 'u1',
        consentType: 'assessment',
      });

      const result = await service.checkConsent('u1', 'assessment');

      expect(result).toBe(true);
      expect(consentRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'u1', consentType: 'assessment' },
        order: { signedAt: 'DESC' },
      });
    });

    it('should return false when consent not found', async () => {
      mockConsentRepo.findOne.mockResolvedValue(null);

      const result = await service.checkConsent('u1', 'assessment');

      expect(result).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should find one record by id', async () => {
      const record = { id: 'cr1', userId: 'u1' };
      mockConsentRepo.findOne.mockResolvedValue(record);

      const result = await service.findOne('cr1');

      expect(consentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cr1' },
      });
      expect(result).toEqual(record);
    });
  });
});
