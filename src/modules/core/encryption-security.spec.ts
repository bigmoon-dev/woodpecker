/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EncryptionService } from '../core/encryption.service';

describe('Encryption Security', () => {
  let service: EncryptionService;
  let dataSource: { query: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('test-key') };
    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(EncryptionService);
  });

  it('encrypts and decrypts empty string', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ encrypted: Buffer.from('enc') }])
      .mockResolvedValueOnce([{ decrypted: '' }]);
    const enc = await service.encrypt('');
    const dec = await service.decrypt(enc);
    expect(dec).toBe('');
  });

  it('handles unicode and special characters', async () => {
    const unicode = '张三🎉你好世界';
    dataSource.query
      .mockResolvedValueOnce([{ encrypted: Buffer.from('enc') }])
      .mockResolvedValueOnce([{ decrypted: unicode }]);
    await service.encrypt(unicode);
    const dec = await service.decrypt(Buffer.from('enc'));
    expect(dec).toBe(unicode);
  });

  it('uses fallback dev key when ENCRYPTION_KEY not configured', async () => {
    configService.get.mockReturnValue('default-dev-key-change-in-prod');
    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    const svc = module.get(EncryptionService);
    dataSource.query.mockResolvedValue([{ encrypted: Buffer.from('x') }]);
    await svc.encrypt('test');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['default-dev-key-change-in-prod']),
    );
  });

  it('propagates error when database encryption fails', async () => {
    dataSource.query.mockRejectedValue(new Error('pgcrypto not available'));
    await expect(service.encrypt('test')).rejects.toThrow(
      'pgcrypto not available',
    );
  });

  it('does not expose encryption key in error messages', async () => {
    dataSource.query.mockRejectedValue(new Error('connection lost'));
    try {
      await service.encrypt('test');
    } catch (e: any) {
      expect(e.message).not.toContain('test-key');
    }
  });

  it('handles oversized input without crashing', async () => {
    const largePayload = 'A'.repeat(1024 * 1024);
    dataSource.query.mockResolvedValue([{ encrypted: Buffer.from('enc') }]);
    await expect(service.encrypt(largePayload)).resolves.toBeDefined();
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([largePayload]),
    );
  });

  it('encrypted output cannot be reversed without the key (masking irreversibility)', async () => {
    const original = 'sensitive-data-12345';
    const encryptedBuffer = Buffer.from('not-the-original-data');
    dataSource.query.mockResolvedValueOnce([{ encrypted: encryptedBuffer }]);
    const result = await service.encrypt(original);
    expect(result.toString()).not.toBe(original);
    expect(result).not.toEqual(Buffer.from(original));
  });
});
