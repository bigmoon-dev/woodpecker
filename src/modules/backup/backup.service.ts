/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-base-to-string */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const APP_DIR = path.resolve(__dirname, '..', '..', '..');

function getUserDataDir(): string {
  const platform = os.platform();
  let base: string;
  if (platform === 'win32') {
    base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    base =
      process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }
  return path.join(base, 'woodpecker');
}

function escapeSql(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

interface TableRow {
  tablename: string;
}

interface ColumnRow {
  column_name: string;
}

interface DataRow {
  [key: string]: unknown;
}

interface SeqRow {
  table_name: string;
}

@Injectable()
export class BackupService {
  constructor(private configService: ConfigService) {}

  private createPool(): Pool {
    return new Pool({
      host: '127.0.0.1',
      port: parseInt(this.configService.get<string>('DB_PORT', '15432'), 10),
      user: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_DATABASE', 'psych_scale'),
    });
  }

  getBackupsDir(): string {
    const dir = path.join(getUserDataDir(), 'backups');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getVersion(): string {
    const versionPath = path.join(APP_DIR, 'version.json');
    try {
      const content = fs.readFileSync(versionPath, 'utf-8');
      const data: { version?: string } = JSON.parse(content) as {
        version?: string;
      };
      return data.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async createBackup(
    name?: string,
  ): Promise<{ fileName: string; size: number; createdAt: string }> {
    const backupsDir = this.getBackupsDir();
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 15)
      .replace(/(\d{8})(\d{4})(\d{2})/, '$1_$2$3');
    const version = this.getVersion();
    const fileName = name
      ? name.endsWith('.sql')
        ? name
        : `${name}.sql`
      : `backup_${timestamp}_v${version}.sql`;
    const filePath = path.join(backupsDir, fileName);

    const pool = this.createPool();
    try {
      const tablesResult: QueryResult<TableRow> = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );
      const tables = tablesResult.rows.map((r: TableRow) => r.tablename);

      const lines: string[] = [];
      lines.push('-- Woodpecker Database Backup');
      lines.push(`-- Version: ${version}`);
      lines.push(`-- Date: ${now.toISOString()}`);
      lines.push(`-- Tables: ${tables.join(', ')}`);
      lines.push('');
      lines.push('BEGIN;');
      lines.push('SET session_replication_role = replica;');
      lines.push(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE;`);
      lines.push('');

      for (const table of tables) {
        lines.push(`-- Table: ${table}`);

        const columnsResult: QueryResult<ColumnRow> = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [table],
        );
        const columns = columnsResult.rows.map((r: ColumnRow) => r.column_name);

        if (columns.length === 0) continue;

        const dataResult: QueryResult<DataRow> = await pool.query(
          `SELECT * FROM "${table}"`,
        );
        for (const row of dataResult.rows) {
          const values = columns.map((col: string) => escapeSql(row[col]));
          lines.push(
            `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${values.join(', ')});`,
          );
        }
        lines.push('');
      }

      const seqResult: QueryResult<SeqRow> = await pool.query(
        `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval%' GROUP BY table_name`,
      );
      for (const row of seqResult.rows) {
        lines.push(
          `SELECT setval(pg_get_serial_sequence(${escapeSql(row.table_name)}, 'id'), coalesce((SELECT max(id) FROM "${row.table_name}"), 1));`,
        );
      }

      lines.push('SET session_replication_role = DEFAULT;');
      lines.push('COMMIT;');

      fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

      const stat = fs.statSync(filePath);
      return {
        fileName,
        size: stat.size,
        createdAt: now.toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Backup failed: ${msg}`);
    } finally {
      await pool.end();
    }
  }

  listBackups(): { fileName: string; size: number; createdAt: string }[] {
    const backupsDir = this.getBackupsDir();
    const entries = fs.readdirSync(backupsDir);
    const sqlFiles = entries.filter((e) => e.endsWith('.sql'));

    return sqlFiles
      .map((fileName) => {
        const filePath = path.join(backupsDir, fileName);
        try {
          const stat = fs.statSync(filePath);
          return {
            fileName,
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
          };
        } catch {
          return null;
        }
      })
      .filter(
        (e): e is { fileName: string; size: number; createdAt: string } =>
          e !== null,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private validateFileName(fileName: string): void {
    if (
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\')
    ) {
      throw new BadRequestException('Invalid file name');
    }
  }

  async restoreBackup(fileName: string): Promise<void> {
    this.validateFileName(fileName);
    const backupsDir = this.getBackupsDir();
    const filePath = path.join(backupsDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file not found: ${fileName}`);
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    const pool = this.createPool();
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Restore failed: ${msg}`);
    } finally {
      await pool.end();
    }
  }

  deleteBackup(fileName: string): void {
    this.validateFileName(fileName);
    const backupsDir = this.getBackupsDir();
    const filePath = path.join(backupsDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Backup file not found: ${fileName}`);
    }

    fs.unlinkSync(filePath);
  }
}
