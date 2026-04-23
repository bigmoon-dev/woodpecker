const path = require('path');
const fs = require('fs');
const os = require('os');
const { Pool } = require('pg');

const APP_DIR = path.resolve(__dirname, '..');

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

const backup = {
  getDataDir() {
    const platform = os.platform();
    let base;
    if (platform === 'win32') {
      base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    } else if (platform === 'darwin') {
      base = path.join(os.homedir(), 'Library', 'Application Support');
    } else {
      base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    }
    return path.join(base, 'woodpecker');
  },

  async createBackup(version) {
    const dataDir = backup.getDataDir();
    const backupsDir = path.join(dataDir, 'backups');

    try {
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const now = new Date();
      const ts = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '_',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
      ].join('');
      const fileName = `backup_${ts}_v${version}.sql`;
      const filePath = path.join(backupsDir, fileName);

      const pool = new Pool({
        host: '127.0.0.1',
        port: 15432,
        user: 'postgres',
        password: 'postgres',
        database: 'psych_scale',
      });

      try {
        const tablesResult = await pool.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
        );
        const tables = tablesResult.rows.map((r) => r.tablename);

        const lines = [];
        lines.push('-- Woodpecker Database Backup');
        lines.push(`-- Version: ${version}`);
        lines.push(`-- Date: ${now.toISOString()}`);
        lines.push(`-- Tables: ${tables.join(', ')}`);
        lines.push('');
        lines.push('BEGIN;');
        lines.push('SET session_replication_role = replica;');
        lines.push(
          `TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE;`,
        );
        lines.push('');

        for (const table of tables) {
          lines.push(`-- Table: ${table}`);

          const columnsResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
            [table],
          );
          const columns = columnsResult.rows.map((r) => r.column_name);

          if (columns.length === 0) continue;

          const dataResult = await pool.query(`SELECT * FROM "${table}"`);
          for (const row of dataResult.rows) {
            const values = columns.map((col) => escapeSql(row[col]));
            lines.push(
              `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${values.join(', ')});`,
            );
          }
          lines.push('');
        }

        const seqResult = await pool.query(
          `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval%' GROUP BY table_name`,
        );
        for (const row of seqResult.rows) {
          lines.push(
            `SELECT setval(pg_get_serial_sequence(${escapeSql(row.table_name)}, 'id'), coalesce((SELECT max(id) FROM "${row.table_name}"), 1));`,
          );
        }

        lines.push('COMMIT;');

        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
      } finally {
        await pool.end();
      }

      const stats = fs.statSync(filePath);
      return { fileName, size: stats.size };
    } catch (err) {
      console.error(`数据库备份失败: ${err.message}`);
      return null;
    }
  },

  cleanupOldBackups(maxCount = 10) {
    const dataDir = backup.getDataDir();
    const backupsDir = path.join(dataDir, 'backups');

    if (!fs.existsSync(backupsDir)) return;

    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(backupsDir, f),
        mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (let i = maxCount; i < files.length; i++) {
      try {
        fs.unlinkSync(files[i].path);
      } catch (err) {
        console.error(`删除旧备份失败 ${files[i].name}: ${err.message}`);
      }
    }
  },
};

module.exports = backup;
