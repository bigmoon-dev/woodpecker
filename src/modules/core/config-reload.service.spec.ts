/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SystemConfig } from '../../entities/config/system-config.entity';
import { ConfigReloadService } from './config-reload.service';

describe('ConfigReloadService', () => {
  let service: ConfigReloadService;
  let repo: any;

  const mockRepo = {
    find: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn((d) => d),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigReloadService,
        { provide: getRepositoryToken(SystemConfig), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ConfigReloadService>(ConfigReloadService);
    repo = module.get(getRepositoryToken(SystemConfig));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('loads config from DB on init', async () => {
    mockRepo.find.mockResolvedValue([
      { key: 'DATA_RETENTION_DAYS', value: '90', category: 'retention' },
    ]);
    await service.onModuleInit();
    expect(service.get('DATA_RETENTION_DAYS')).toBe('90');
  });

  it('falls back to process.env when key not in DB', () => {
    process.env._TEST_CONFIG_KEY = 'from-env';
    expect(service.get('_TEST_CONFIG_KEY')).toBe('from-env');
    delete process.env._TEST_CONFIG_KEY;
  });

  it('returns defaultValue when key not found anywhere', () => {
    expect(service.get('_NONEXISTENT_KEY', 42)).toBe(42);
  });

  it('coerces string to number when defaultValue is number', async () => {
    mockRepo.find.mockResolvedValue([
      { key: 'RETENTION', value: '180', category: 'retention' },
    ]);
    await service.onModuleInit();
    expect(service.get('RETENTION', 0)).toBe(180);
  });

  it('coerces string to boolean when defaultValue is boolean', async () => {
    mockRepo.find.mockResolvedValue([
      { key: 'FEATURE_FLAG', value: 'true', category: 'general' },
    ]);
    await service.onModuleInit();
    expect(service.get('FEATURE_FLAG', false)).toBe(true);
  });

  it('sets a config value and updates cache', async () => {
    mockRepo.find.mockResolvedValue([]);
    await service.onModuleInit();
    mockRepo.save.mockResolvedValue({ key: 'NEW_KEY', value: 'new-val' });

    await service.set('NEW_KEY', 'new-val', 'admin');

    expect(repo.save).toHaveBeenCalled();
    expect(service.get('NEW_KEY')).toBe('new-val');
  });

  it('deletes a config value and removes from cache', async () => {
    mockRepo.find.mockResolvedValue([
      { key: 'TEMP_KEY', value: 'temp', category: 'general' },
    ]);
    await service.onModuleInit();
    mockRepo.delete.mockResolvedValue({ affected: 1 });

    await service.remove('TEMP_KEY');

    expect(repo.delete).toHaveBeenCalledWith('TEMP_KEY');
    expect(service.get('TEMP_KEY')).toBeUndefined();
  });

  it('reloads cache from DB on reload()', async () => {
    mockRepo.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { key: 'REFRESHED', value: 'yes', category: 'general' },
      ]);

    await service.onModuleInit();
    expect(service.get('REFRESHED')).toBeUndefined();

    await service.reload();
    expect(service.get('REFRESHED')).toBe('yes');
  });

  it('masks sensitive key values', () => {
    expect(service.maskValue('AUDIT_HMAC_SECRET', 'abcdef1234567890')).toBe(
      'abcd****',
    );
    expect(service.maskValue('ENCRYPTION_KEY', 'secretkey123')).toBe(
      'secr****',
    );
    expect(service.maskValue('DATA_RETENTION_DAYS', '365')).toBe('365');
  });

  it('findAll returns configs ordered by category and key', async () => {
    mockRepo.find.mockResolvedValue([
      { key: 'A_KEY', value: '1', category: 'retention' },
      { key: 'B_KEY', value: '2', category: 'general' },
    ]);
    const result = await service.findAll();
    expect(repo.find).toHaveBeenCalledWith({
      order: { category: 'ASC', key: 'ASC' },
    });
    expect(result).toHaveLength(2);
  });
});
