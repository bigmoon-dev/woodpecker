const path = require('path');
const fs = require('fs');
const os = require('os');

const backup = require('../backup');

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined),
  };
  return { Pool: jest.fn().mockReturnValue(mockPool) };
});

jest.mock('os', () => {
  const actualOs = jest.requireActual('os');
  return {
    ...actualOs,
    platform: jest.fn(),
    homedir: jest.fn(() => '/home/testuser'),
  };
});

const mockPool = new (require('pg').Pool)();

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
    jest.clearAllMocks();
    os.platform.mockReturnValue('linux');
    tmpDir = path.join(os.tmpdir(), `backup-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    getDataDirSpy = jest.spyOn(backup, 'getDataDir').mockReturnValue(tmpDir);
    mockPool.query.mockReset();
    mockPool.end.mockResolvedValue(undefined);
  });

  afterEach(() => {
    getDataDirSpy.mockRestore();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  test('creates backup successfully', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ tablename: 'users' }] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockPool.query.mockResolvedValueOnce({ rows: [] });

    const result = await backup.createBackup('1.0.0');

    expect(result).not.toBeNull();
    expect(result.fileName).toMatch(/^backup_\d{8}_\d{6}_v1\.0\.0\.sql$/);
    expect(result.size).toBeGreaterThan(0);

    const files = fs.readdirSync(path.join(tmpDir, 'backups'));
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(tmpDir, 'backups', files[0]), 'utf8');
    expect(content).toContain('BEGIN;');
    expect(content).toContain('COMMIT;');
  });

  test('creates backups directory if not exists', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    await backup.createBackup('2.0.0');

    expect(fs.existsSync(path.join(tmpDir, 'backups'))).toBe(true);
  });

  test('handles empty database', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const result = await backup.createBackup('1.0.0');

    expect(result).not.toBeNull();
    expect(result.fileName).toMatch(/^backup_.*\.sql$/);
  });

  test('returns null on pool failure', async () => {
    mockPool.query.mockRejectedValue(new Error('connection failed'));

    const result = await backup.createBackup('1.0.0');

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
