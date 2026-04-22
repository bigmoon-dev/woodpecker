/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import * as fs from 'fs';
import * as os from 'os';

jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return { Pool: jest.fn().mockReturnValue(mockPool) };
});
jest.mock('fs');
jest.mock('os');

const mockPool = new (require('pg').Pool)();

describe('BackupService', () => {
  let service: BackupService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.homedir as jest.Mock).mockReturnValue('/home/testuser');
    mockConfigService.get.mockImplementation((key: string, def: any) => {
      const map: Record<string, any> = {
        DB_PORT: '15432',
        DB_USERNAME: 'postgres',
        DB_DATABASE: 'psych_scale',
        DB_PASSWORD: 'postgres',
      };
      return map[key] ?? def;
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"1.0.0"}');
    (fs.statSync as jest.Mock).mockReturnValue({
      size: 1024,
      birthtime: new Date('2024-01-01T00:00:00Z'),
    });
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    mockPool.query.mockResolvedValue({ rows: [] });
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [] });
    mockClient.release.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<BackupService>(BackupService);
  });

  describe('getVersion', () => {
    it('returns version from version.json', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"1.0.0"}');
      expect(service.getVersion()).toBe('1.0.0');
    });

    it('returns unknown on file not found', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('not found');
      });
      expect(service.getVersion()).toBe('unknown');
    });
  });

  describe('getBackupsDir', () => {
    it('creates directory if not exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const dir = service.getBackupsDir();
      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
      expect(dir).toContain('backups');
    });

    it('returns existing directory', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const dir = service.getBackupsDir();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(dir).toContain('backups');
    });
  });

  describe('createBackup', () => {
    it('creates backup with default name', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ tablename: 'users' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [{ column_name: 'id' }],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createBackup();
      expect(result.fileName).toMatch(/^backup_.*\.sql$/);
      expect(result.size).toBe(1024);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('creates backup with custom name', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createBackup('my_backup');
      expect(result.fileName).toBe('my_backup.sql');
    });

    it('creates backup with custom name ending in .sql', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.createBackup('my_backup.sql');
      expect(result.fileName).toBe('my_backup.sql');
    });

    it('creates backup dir if not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.createBackup('test');
      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('throws on pool query failure', async () => {
      mockPool.query.mockRejectedValue(new Error('connection failed'));

      await expect(service.createBackup()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('listBackups', () => {
    it('returns empty array for empty dir', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([]);
      const result = service.listBackups();
      expect(result).toEqual([]);
    });

    it('returns multiple sql files', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'a.sql',
        'b.sql',
        'c.txt',
      ]);
      const result = service.listBackups();
      expect(result).toHaveLength(2);
      expect(result[0].fileName).toMatch(/\.sql$/);
    });

    it('filters non-sql files', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'a.txt',
        'b.json',
        'c.sql',
      ]);
      const result = service.listBackups();
      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('c.sql');
    });
  });

  describe('restoreBackup', () => {
    it('restores a backup', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('SELECT 1;');

      await expect(service.restoreBackup('test.sql')).resolves.toBeUndefined();
    });

    it('throws on file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      await expect(service.restoreBackup('missing.sql')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws on path traversal with ..', async () => {
      await expect(service.restoreBackup('..etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on path traversal with /', async () => {
      await expect(service.restoreBackup('/etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on path traversal with \\', async () => {
      await expect(service.restoreBackup('\\etc\\passwd')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws on restore query failure', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('BAD SQL;');
      mockPool.query.mockRejectedValueOnce(new Error('syntax error'));

      await expect(service.restoreBackup('test.sql')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deleteBackup', () => {
    it('deletes a backup file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      service.deleteBackup('test.sql');
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('throws on file not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(() => service.deleteBackup('missing.sql')).toThrow(
        NotFoundException,
      );
    });

    it('throws on path traversal', () => {
      expect(() => service.deleteBackup('../etc/passwd')).toThrow(
        BadRequestException,
      );
    });
  });
});
