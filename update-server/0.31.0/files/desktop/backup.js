const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_DIR = path.resolve(__dirname, '..');

const backup = {
  getPgDumpPath() {
    const platform = os.platform();
    if (platform === 'linux') {
      return path.join(APP_DIR, 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin', 'pg_dump');
    }
    if (platform === 'win32') {
      return path.join(APP_DIR, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin', 'pg_dump.exe');
    }
    if (platform === 'darwin') {
      return path.join(APP_DIR, 'node_modules', '@embedded-postgres', 'darwin-arm64', 'native', 'bin', 'pg_dump');
    }
    throw new Error(`Unsupported platform: ${platform}`);
  },

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

  createBackup(version) {
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

      const pgDumpPath = backup.getPgDumpPath();
      const output = execFileSync(pgDumpPath, [
        '--clean', '--if-exists', '-U', 'postgres', '-p', '15432', '-d', 'psych_scale',
      ], {
        env: { PGPASSWORD: 'postgres' },
        encoding: 'utf8',
      });

      fs.writeFileSync(filePath, output);

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
