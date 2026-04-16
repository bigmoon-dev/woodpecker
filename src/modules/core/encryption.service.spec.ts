/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
import { DataSource } from 'typeorm';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let dataSource: any;

  beforeEach(async () => {
    const mockDataSource = { query: jest.fn() };
    const mockConfigService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'ENCRYPTION_KEY') return 'test-encryption-key';
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    dataSource = module.get(DataSource);
  });

  it('should encrypt plaintext and return buffer', async () => {
    const buf = Buffer.from('encrypted-data');
    dataSource.query.mockResolvedValue([{ encrypted: buf }]);
    const result = await service.encrypt('hello');
    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT pgp_sym_encrypt($1, $2) AS encrypted',
      ['hello', 'test-encryption-key'],
    );
    expect(result).toBe(buf);
  });

  it('should decrypt ciphertext and return string', async () => {
    dataSource.query.mockResolvedValue([{ decrypted: 'hello' }]);
    const cipher = Buffer.from('fake-cipher');
    const result = await service.decrypt(cipher);
    expect(dataSource.query).toHaveBeenCalledWith(
      'SELECT pgp_sym_decrypt($1, $2) AS decrypted',
      [cipher, 'test-encryption-key'],
    );
    expect(result).toBe('hello');
  });

  it('should batch decrypt multiple student IDs', async () => {
    const rows = [
      { id: 's1', name: 'Alice', student_number: '001' },
      { id: 's2', name: 'Bob', student_number: '002' },
    ];
    dataSource.query.mockResolvedValue(rows);
    const result = await service.batchDecrypt(['s1', 's2']);
    expect(result).toBeInstanceOf(Map);
    expect(result.get('s1')).toEqual({ name: 'Alice', studentNumber: '001' });
    expect(result.get('s2')).toEqual({ name: 'Bob', studentNumber: '002' });
  });

  it('should return empty map for empty studentIds array', async () => {
    const result = await service.batchDecrypt([]);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should return partial map when some IDs not in DB', async () => {
    const rows = [{ id: 's1', name: 'Alice', student_number: '001' }];
    dataSource.query.mockResolvedValue(rows);
    const result = await service.batchDecrypt(['s1', 's2']);
    expect(result.size).toBe(1);
    expect(result.get('s1')).toEqual({ name: 'Alice', studentNumber: '001' });
    expect(result.has('s2')).toBe(false);
  });

  it('should propagate database errors', async () => {
    dataSource.query.mockRejectedValue(new Error('connection lost'));
    await expect(service.encrypt('test')).rejects.toThrow('connection lost');
  });

  it('should use config key for all operations', async () => {
    dataSource.query.mockResolvedValue([{ encrypted: Buffer.alloc(0) }]);
    await service.encrypt('test');
    const call = dataSource.query.mock.calls[0];
    expect(call[1][1]).toBe('test-encryption-key');
  });
});
