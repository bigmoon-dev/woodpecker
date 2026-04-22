const path = require('path');
const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');

const backup = require('../backup');

jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

jest.mock('os', () => {
  const actualOs = jest.requireActual('os');
  return {
    ...actualOs,
    platform: jest.fn(),
    homedir: jest.fn(() => '/home/testuser'),
  };
});

describe('getPgDumpPath', () => {
  const APP_DIR = path.resolve(__dirname, '../..');

  test('returns linux path', () => {
    os.platform.mockReturnValue('linux');
    const result = backup.getPgDumpPath();
    expect(result).toBe(path.join(APP_DIR, 'node_modules/@embedded-postgres/linux-x64/native/bin/pg_dump'));
  });

  test('returns win32 path', () => {
    os.platform.mockReturnValue('win32');
    const result = backup.getPgDumpPath();
    expect(result).toBe(path.join(APP_DIR, 'node_modules/@embedded-postgres/windows-x64/native/bin/pg_dump.exe'));
  });

  test('returns darwin path', () => {
    os.platform.mockReturnValue('darwin');
    const result = backup.getPgDumpPath();
    expect(result).toBe(path.join(APP_DIR, 'node_modules/@embedded-postgres/darwin-arm64/native/bin/pg_dump'));
  });

  test('throws for unsupported platform', () => {
    os.platform.mockReturnValue('freebsd');
    expect(() => backup.getPgDumpPath()).toThrow('Unsupported platform');
  });
});

describe('getDataDir', () => {
  test('returns linux path', () => {
    os.platform.mockReturnValue('linux');
    const result = backup.getDataDir();
    expect(result).toBe(path.join('/home/testuser/.local/share/woodpecker'));
  });

  test('returns linux path with XDG_DATA_HOME', () => {
    os.platform.mockReturnValue('linux');
    const origXdg = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = '/custom/data';
    const result = backup.getDataDir();
    expect(result).toBe(path.join('/custom/data/woodpecker'));
    if (origXdg !== undefined) process.env.XDG_DATA_HOME = origXdg;
    else delete process.env.XDG_DATA_HOME;
  });

  test('returns win32 path', () => {
    os.platform.mockReturnValue('win32');
    const origAppdata = process.env.APPDATA;
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';
    const result = backup.getDataDir();
    expect(result).toBe(path.join('C:\\Users\\test\\AppData\\Roaming', 'woodpecker'));
    if (origAppdata !== undefined) process.env.APPDATA = origAppdata;
    else delete process.env.APPDATA;
  });

  test('returns darwin path', () => {
    os.platform.mockReturnValue('darwin');
    const result = backup.getDataDir();
    expect(result).toBe(path.join('/home/testuser/Library/Application Support/woodpecker'));
  });
});

describe('createBackup', () => {
  let tmpDir;
  let getDataDirSpy;

  beforeEach(() => {
    os.platform.mockReturnValue('linux');
    tmpDir = path.join(os.tmpdir(), `backup-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    getDataDirSpy = jest.spyOn(backup, 'getDataDir').mockReturnValue(tmpDir);
    childProcess.execFileSync.mockReset();
  });

  afterEach(() => {
    getDataDirSpy.mockRestore();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  test('creates backup successfully', () => {
    const sqlDump = 'CREATE TABLE test (id int);';
    childProcess.execFileSync.mockReturnValue(sqlDump);

    const result = backup.createBackup('1.0.0');

    expect(result).not.toBeNull();
    expect(result.fileName).toMatch(/^backup_\d{8}_\d{6}_v1\.0\.0\.sql$/);
    expect(result.size).toBe(sqlDump.length);

    const files = fs.readdirSync(path.join(tmpDir, 'backups'));
    expect(files.length).toBe(1);
    expect(fs.readFileSync(path.join(tmpDir, 'backups', files[0]), 'utf8')).toBe(sqlDump);
  });

  test('creates backups directory if not exists', () => {
    childProcess.execFileSync.mockReturnValue('dump');

    backup.createBackup('2.0.0');

    expect(fs.existsSync(path.join(tmpDir, 'backups'))).toBe(true);
  });

  test('calls pg_dump with correct args', () => {
    childProcess.execFileSync.mockReturnValue('dump');

    backup.createBackup('1.0.0');

    const calls = childProcess.execFileSync.mock.calls;
    expect(calls.length).toBe(1);
    const [pgDumpPath, args, options] = calls[0];
    expect(args).toEqual(['--clean', '--if-exists', '-U', 'postgres', '-p', '15432', '-d', 'psych_scale']);
    expect(options.env).toEqual({ PGPASSWORD: 'postgres' });
  });

  test('returns null on pg_dump failure', () => {
    childProcess.execFileSync.mockImplementation(() => {
      throw new Error('pg_dump failed');
    });

    const result = backup.createBackup('1.0.0');

    expect(result).toBeNull();
  });

  test('returns null on write failure', () => {
    childProcess.execFileSync.mockReturnValue('dump');
    getDataDirSpy.mockReturnValue('/nonexistent/path/that/cannot/be/created');

    const result = backup.createBackup('1.0.0');

    expect(result).toBeNull();
  });
});

describe('cleanupOldBackups', () => {
  let tmpDir;
  let getDataDirSpy;

  beforeEach(() => {
    os.platform.mockReturnValue('linux');
    tmpDir = path.join(os.tmpdir(), `backup-cleanup-test-${Date.now()}`);
    fs.mkdirSync(path.join(tmpDir, 'backups'), { recursive: true });
    getDataDirSpy = jest.spyOn(backup, 'getDataDir').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    getDataDirSpy.mockRestore();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  test('keeps maxCount files and deletes rest', () => {
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const fpath = path.join(tmpDir, 'backups', `backup_${String(i).padStart(2, '0')}.sql`);
      fs.writeFileSync(fpath, `dump ${i}`);
      const dt = new Date(now - (12 - i) * 60000);
      fs.utimesSync(fpath, dt, dt);
    }

    backup.cleanupOldBackups(10);

    const remaining = fs.readdirSync(path.join(tmpDir, 'backups')).filter(f => f.endsWith('.sql'));
    expect(remaining.length).toBe(10);
  });

  test('does nothing when fewer than maxCount', () => {
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tmpDir, 'backups', `backup_${i}.sql`), `dump ${i}`);
    }

    backup.cleanupOldBackups(10);

    const remaining = fs.readdirSync(path.join(tmpDir, 'backups')).filter(f => f.endsWith('.sql'));
    expect(remaining.length).toBe(5);
  });

  test('does nothing when backups dir does not exist', () => {
    const noDir = path.join(os.tmpdir(), `backup-nodir-${Date.now()}`);
    getDataDirSpy.mockReturnValue(noDir);

    expect(() => backup.cleanupOldBackups(10)).not.toThrow();
  });

  test('deletes oldest files', () => {
    const now = Date.now();
    const names = [];
    for (let i = 0; i < 5; i++) {
      const name = `backup_${String(i).padStart(2, '0')}.sql`;
      names.push(name);
      const fpath = path.join(tmpDir, 'backups', name);
      fs.writeFileSync(fpath, `dump ${i}`);
      const dt = new Date(now - (5 - i) * 60000);
      fs.utimesSync(fpath, dt, dt);
    }

    backup.cleanupOldBackups(3);

    const remaining = fs.readdirSync(path.join(tmpDir, 'backups')).filter(f => f.endsWith('.sql')).sort();
    expect(remaining).toEqual(['backup_02.sql', 'backup_03.sql', 'backup_04.sql']);
  });
});
