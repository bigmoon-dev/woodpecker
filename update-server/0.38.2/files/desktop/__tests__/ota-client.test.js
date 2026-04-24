const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const ota = require('../ota-client');

const TMP_DIR = path.join(__dirname, '__ota_tmp__');

function setupTestEnv() {
  cleanupTestEnv();
  fs.mkdirSync(path.join(TMP_DIR, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'public'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'backup'), { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'console.log("hello")');
  fs.writeFileSync(path.join(TMP_DIR, 'public', 'index.html'), '<html></html>');
  fs.writeFileSync(
    path.join(TMP_DIR, 'package.json'),
    JSON.stringify({ version: '0.22.1' })
  );
}

function cleanupTestEnv() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true });
  }
}

function generateTestKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  return { pubPem, privPem };
}

function createTestServer(handler) {
  const server = http.createServer(handler);
  server.listen(0);
  const port = server.address().port;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

const origConfig = {};

beforeAll(() => {
  Object.assign(origConfig, ota._config);
});

afterAll(() => {
  ota.configure(origConfig);
  cleanupTestEnv();
});

describe('compareVersions', () => {
  test('equal versions', () => {
    expect(ota.compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(ota.compareVersions('0.22.1', '0.22.1')).toBe(0);
  });

  test('greater', () => {
    expect(ota.compareVersions('1.0.0', '0.9.9')).toBe(1);
    expect(ota.compareVersions('0.23.0', '0.22.1')).toBe(1);
  });

  test('less', () => {
    expect(ota.compareVersions('0.9.9', '1.0.0')).toBe(-1);
    expect(ota.compareVersions('0.22.1', '0.23.0')).toBe(-1);
  });

  test('major/minor/patch comparison', () => {
    expect(ota.compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(ota.compareVersions('0.10.0', '0.9.0')).toBe(1);
    expect(ota.compareVersions('0.0.2', '0.0.1')).toBe(1);
  });
});

describe('getCurrentVersion', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('reads from version.json', () => {
    fs.writeFileSync(
      path.join(TMP_DIR, 'version.json'),
      JSON.stringify({ version: '0.23.0' })
    );
    expect(ota.getCurrentVersion()).toBe('0.23.0');
  });

  test('falls back to package.json', () => {
    expect(ota.getCurrentVersion()).toBe('0.22.1');
  });

  test('returns null when no version found', () => {
    fs.rmSync(path.join(TMP_DIR, 'package.json'));
    expect(ota.getCurrentVersion()).toBeNull();
  });
});

describe('setCurrentVersion', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('writes version.json', () => {
    ota.setCurrentVersion('0.23.0');
    const data = JSON.parse(fs.readFileSync(path.join(TMP_DIR, 'version.json'), 'utf8'));
    expect(data.version).toBe('0.23.0');
    expect(data.lastUpdated).toBeDefined();
  });
});

describe('verifyManifest', () => {
  test('valid signature passes', () => {
    const { pubPem, privPem } = generateTestKeys();
    const manifest = {
      version: '0.23.0',
      releaseDate: '2026-04-18',
      files: { 'dist/main.js': { hash: 'abc', size: 100 } },
    };
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(JSON.stringify(manifest));
    manifest.signature = sign.sign(privPem, 'base64');

    expect(ota.verifyManifest(manifest, pubPem)).toBe(true);
  });

  test('invalid signature fails', () => {
    const { pubPem } = generateTestKeys();
    const manifest = {
      version: '0.23.0',
      files: {},
      signature: 'invalidsig',
    };
    expect(ota.verifyManifest(manifest, pubPem)).toBe(false);
  });

  test('tampered content fails', () => {
    const { pubPem, privPem } = generateTestKeys();
    const manifest = {
      version: '0.23.0',
      files: { 'dist/main.js': { hash: 'abc', size: 100 } },
    };
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(JSON.stringify(manifest));
    manifest.signature = sign.sign(privPem, 'base64');

    const tampered = { ...manifest, version: '9.9.9' };
    expect(ota.verifyManifest(tampered, pubPem)).toBe(false);
  });

  test('missing signature fails', () => {
    const { pubPem } = generateTestKeys();
    const manifest = { version: '0.23.0', files: {} };
    expect(ota.verifyManifest(manifest, pubPem)).toBe(false);
  });
});

describe('computeFileHash', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('computes correct SHA-256', () => {
    const filePath = path.join(TMP_DIR, 'dist', 'main.js');
    const hash = ota.computeFileHash(filePath);
    const expected = crypto.createHash('sha256').update('console.log("hello")').digest('hex');
    expect(hash).toBe(expected);
  });
});

describe('getLocalFileHashes', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('scans dist and public dirs', () => {
    const hashes = ota.getLocalFileHashes();
    expect(Object.keys(hashes).length).toBe(2);
    expect(hashes['dist/main.js']).toBeDefined();
    expect(hashes['public/index.html']).toBeDefined();
  });

  test('includes size', () => {
    const hashes = ota.getLocalFileHashes();
    expect(hashes['dist/main.js'].size).toBeGreaterThan(0);
  });
});

describe('computeDiff', () => {
  test('detects new and changed files', () => {
    const local = {
      'dist/main.js': { hash: 'aaa', size: 10 },
      'public/index.html': { hash: 'bbb', size: 20 },
    };
    const manifest = {
      files: {
        'dist/main.js': { hash: 'ccc', size: 15 },
        'public/index.html': { hash: 'bbb', size: 20 },
        'dist/new.js': { hash: 'ddd', size: 5 },
      },
    };
    const diff = ota.computeDiff(local, manifest);
    expect(diff.length).toBe(2);
    expect(diff.map((d) => d.path)).toEqual(
      expect.arrayContaining(['dist/main.js', 'dist/new.js'])
    );
  });

  test('returns empty when all match', () => {
    const local = {
      'dist/main.js': { hash: 'aaa', size: 10 },
    };
    const manifest = { files: { 'dist/main.js': { hash: 'aaa', size: 10 } } };
    expect(ota.computeDiff(local, manifest)).toEqual([]);
  });
});

describe('backupCurrent + rollback', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('backup and restore files', () => {
    const diffFiles = [{ path: 'dist/main.js', hash: 'abc', size: 100 }];
    const originalContent = fs.readFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'utf8');

    ota.backupCurrent(diffFiles);

    fs.writeFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'changed content');
    expect(fs.readFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'utf8')).toBe('changed content');

    ota.rollback('0.22.1');
    expect(fs.readFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'utf8')).toBe(originalContent);
  });

  test('rollback throws on missing backup', () => {
    expect(() => ota.rollback('nonexistent')).toThrow('Backup not found');
  });

  test('cleans up old backups beyond maxBackups', () => {
    ota.configure({ maxBackups: 2 });
    fs.mkdirSync(path.join(TMP_DIR, 'backup', '0.20.0'), { recursive: true });
    fs.mkdirSync(path.join(TMP_DIR, 'backup', '0.21.0'), { recursive: true });
    fs.mkdirSync(path.join(TMP_DIR, 'backup', '0.22.0'), { recursive: true });

    ota.backupCurrent([{ path: 'dist/main.js', hash: 'abc', size: 100 }]);

    const backups = fs.readdirSync(path.join(TMP_DIR, 'backup'));
    expect(backups.length).toBeLessThanOrEqual(2);
  });
});

describe('applyUpdate', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('writes files to correct locations', () => {
    const buffers = [
      { path: 'dist/main.js', buffer: Buffer.from('updated') },
      { path: 'public/new.html', buffer: Buffer.from('<new>') },
    ];
    ota.applyUpdate(buffers);

    expect(fs.readFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'utf8')).toBe('updated');
    expect(fs.readFileSync(path.join(TMP_DIR, 'public', 'new.html'), 'utf8')).toBe('<new>');
  });
});

describe('setPendingVersion + finalizePendingVersion', () => {
  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  test('set and finalize pending version', () => {
    ota.setPendingVersion('0.23.0');
    expect(fs.existsSync(path.join(TMP_DIR, '.pending-version'))).toBe(true);

    const result = ota.finalizePendingVersion();
    expect(result).toBe('0.23.0');
    expect(fs.existsSync(path.join(TMP_DIR, '.pending-version'))).toBe(false);

    const data = JSON.parse(fs.readFileSync(path.join(TMP_DIR, 'version.json'), 'utf8'));
    expect(data.version).toBe('0.23.0');
  });

  test('returns null when no pending version', () => {
    expect(ota.finalizePendingVersion()).toBeNull();
  });
});

describe('fetchJson + fetchBinary', () => {
  let srv;

  afterEach(async () => {
    if (srv) await srv.close();
  });

  test('fetchJson parses JSON response', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: '0.23.0' }));
    });
    const data = await ota.fetchJson(srv.url + '/test');
    expect(data.version).toBe('0.23.0');
  });

  test('fetchJson rejects on HTTP error', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(500);
      res.end('error');
    });
    await expect(ota.fetchJson(srv.url + '/test')).rejects.toThrow('HTTP 500');
  });

  test('fetchBinary returns buffer', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200);
      res.end(Buffer.from('hello'));
    });
    const buf = await ota.fetchBinary(srv.url + '/file');
    expect(buf.toString()).toBe('hello');
  });

  test('fetchJson follows redirects', async () => {
    srv = createTestServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: srv.url + '/target' });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ redirected: true }));
      }
    });
    const data = await ota.fetchJson(srv.url + '/redirect');
    expect(data.redirected).toBe(true);
  });
});

describe('checkForUpdate', () => {
  let srv;

  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  afterEach(async () => {
    if (srv) await srv.close();
  });

  test('returns null when current version is null', async () => {
    fs.rmSync(path.join(TMP_DIR, 'package.json'));
    ota.configure({ baseUrl: 'http://127.0.0.1:1' });
    expect(await ota.checkForUpdate()).toBeNull();
  });

  test('returns update info when new version available', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: '0.23.0',
        minVersion: '0.22.0',
        manifestUrl: `${srv.url}/manifest.json`,
        size: { common: 15000000 },
      }));
    });
    ota.configure({ baseUrl: srv.url });

    const result = await ota.checkForUpdate();
    expect(result).not.toBeNull();
    expect(result.version).toBe('0.23.0');
    expect(result.needsFullUpdate).toBe(false);
  });

  test('returns null when already latest', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: '0.22.1' }));
    });
    ota.configure({ baseUrl: srv.url });

    expect(await ota.checkForUpdate()).toBeNull();
  });

  test('returns null on network error', async () => {
    ota.configure({ baseUrl: 'http://127.0.0.1:1' });
    expect(await ota.checkForUpdate()).toBeNull();
  });

  test('returns needsFullUpdate when version below minVersion', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: '1.0.0',
        minVersion: '0.99.0',
      }));
    });
    ota.configure({ baseUrl: srv.url });

    const result = await ota.checkForUpdate();
    expect(result.needsFullUpdate).toBe(true);
  });
});

describe('getUpdateFiles', () => {
  let srv;
  const { pubPem, privPem } = generateTestKeys();

  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  afterEach(async () => {
    if (srv) await srv.close();
  });

  test('downloads and verifies signed manifest', async () => {
    const { pubPem, privPem } = generateTestKeys();
    const manifest = {
      version: '0.23.0',
      releaseDate: '2026-04-18',
      target: 'common',
      files: {},
    };
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(JSON.stringify(manifest));
    manifest.signature = sign.sign(privPem, 'base64');

    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest));
    });

    ota.configure({ appDir: TMP_DIR, publicKeyPem: pubPem });
    const { diff } = await ota.getUpdateFiles(srv.url + '/manifest.json');
    expect(diff).toEqual([]);
  });

  test('rejects manifest with invalid signature', async () => {
    const manifest = {
      version: '0.23.0',
      files: {},
      signature: 'badsig',
    };

    srv = createTestServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest));
    });

    await expect(ota.getUpdateFiles(srv.url + '/manifest.json')).rejects.toThrow(
      'signature verification failed'
    );
  });
});

describe('downloadFiles', () => {
  let srv;

  beforeEach(() => {
    setupTestEnv();
    ota.configure({ appDir: TMP_DIR });
  });

  afterEach(async () => {
    if (srv) await srv.close();
  });

  test('downloads files and verifies hash', async () => {
    const content = 'new content';
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    srv = createTestServer((req, res) => {
      res.writeHead(200);
      res.end(Buffer.from(content));
    });
    ota.configure({ baseUrl: srv.url });

    const diffFiles = [{ path: 'dist/main.js', hash, size: content.length }];
    const buffers = await ota.downloadFiles('0.23.0', diffFiles);

    expect(buffers.length).toBe(1);
    expect(buffers[0].buffer.toString()).toBe(content);
  });

  test('rejects on hash mismatch', async () => {
    srv = createTestServer((req, res) => {
      res.writeHead(200);
      res.end(Buffer.from('wrong content'));
    });
    ota.configure({ baseUrl: srv.url });

    const diffFiles = [{ path: 'dist/main.js', hash: 'wronghash', size: 10 }];
    await expect(
      ota.downloadFiles('0.23.0', diffFiles)
    ).rejects.toThrow('Hash mismatch');
  });

  test('calls onProgress callback', async () => {
    const content = 'new content';
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    srv = createTestServer((req, res) => {
      res.writeHead(200);
      res.end(Buffer.from(content));
    });
    ota.configure({ baseUrl: srv.url });

    const progress = [];
    const diffFiles = [{ path: 'dist/main.js', hash, size: content.length }];
    await ota.downloadFiles('0.23.0', diffFiles, (downloaded, total) => {
      progress.push({ downloaded, total });
    });

    expect(progress.length).toBeGreaterThan(0);
  });
});
