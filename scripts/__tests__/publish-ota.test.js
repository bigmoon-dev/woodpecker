const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  validateSemver,
  computeFileHash,
  generateManifest,
  signManifest,
  formatBytes,
  scanDir,
} = require('../publish-ota');

const TMP_DIR = path.join(__dirname, '__publish_tmp__');

beforeAll(() => {
  cleanup();
  fs.mkdirSync(path.join(TMP_DIR, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'public'), { recursive: true });
  fs.mkdirSync(path.join(TMP_DIR, 'public', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'dist', 'main.js'), 'console.log("main")');
  fs.writeFileSync(path.join(TMP_DIR, 'dist', 'app.module.js'), 'module.exports = {}');
  fs.writeFileSync(path.join(TMP_DIR, 'public', 'index.html'), '<html></html>');
  fs.writeFileSync(path.join(TMP_DIR, 'public', 'assets', 'logo.png'), Buffer.from('fake-png'));
});

afterAll(() => {
  cleanup();
});

function cleanup() {
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

describe('validateSemver', () => {
  test('valid semver', () => {
    expect(validateSemver('1.0.0')).toBe(true);
    expect(validateSemver('0.22.1')).toBe(true);
    expect(validateSemver('10.20.30')).toBe(true);
  });

  test('invalid semver', () => {
    expect(validateSemver('1.0')).toBe(false);
    expect(validateSemver('v1.0.0')).toBe(false);
    expect(validateSemver('1.0.0-beta')).toBe(false);
    expect(validateSemver('abc')).toBe(false);
    expect(validateSemver('')).toBe(false);
  });
});

describe('computeFileHash', () => {
  test('computes SHA-256 hex', () => {
    const filePath = path.join(TMP_DIR, 'dist', 'main.js');
    const hash = computeFileHash(filePath);
    const expected = crypto.createHash('sha256').update('console.log("main")').digest('hex');
    expect(hash).toBe(expected);
  });
});

describe('generateManifest', () => {
  test('scans dist and public dirs', () => {
    const manifest = generateManifest('0.23.0', TMP_DIR, ['dist', 'public']);
    expect(manifest.version).toBe('0.23.0');
    expect(manifest.target).toBe('common');
    expect(manifest.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(manifest.files).length).toBe(4);
    expect(manifest.files['dist/main.js']).toBeDefined();
    expect(manifest.files['dist/app.module.js']).toBeDefined();
    expect(manifest.files['public/index.html']).toBeDefined();
    expect(manifest.files['public/assets/logo.png']).toBeDefined();
  });

  test('each file has hash and size', () => {
    const manifest = generateManifest('0.23.0', TMP_DIR, ['dist', 'public']);
    for (const info of Object.values(manifest.files)) {
      expect(info.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(info.size).toBeGreaterThan(0);
    }
  });

  test('skips missing dirs', () => {
    const manifest = generateManifest('0.23.0', TMP_DIR, ['nonexistent']);
    expect(Object.keys(manifest.files).length).toBe(0);
  });

  test('totalSize and fileCount are correct', () => {
    const manifest = generateManifest('0.23.0', TMP_DIR, ['dist', 'public']);
    const expectedSize = Object.values(manifest.files).reduce((s, f) => s + f.size, 0);
    expect(manifest.totalSize).toBe(expectedSize);
    expect(manifest.fileCount).toBe(4);
  });
});

describe('signManifest', () => {
  test('signs manifest with RSA-SHA256', () => {
    const { privPem, pubPem } = generateTestKeys();
    const keyPath = path.join(TMP_DIR, 'test-private.key');
    fs.writeFileSync(keyPath, privPem);

    const manifest = generateManifest('0.23.0', TMP_DIR, ['dist']);
    const signature = signManifest(manifest, keyPath);
    expect(signature).toBeTruthy();

    const verify = crypto.createVerify('RSA-SHA256');
    const { signature: _, ...data } = manifest;
    verify.update(JSON.stringify(data));
    expect(verify.verify(pubPem, signature, 'base64')).toBe(true);
  });
});

describe('formatBytes', () => {
  test('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(15728640)).toBe('15.0 MB');
  });
});

describe('scanDir', () => {
  test('recursively lists all files', () => {
    const results = [];
    scanDir(TMP_DIR, TMP_DIR, results);
    const paths = results.map((r) => r.path);
    expect(paths).toContain('dist/main.js');
    expect(paths).toContain('dist/app.module.js');
    expect(paths).toContain('public/index.html');
    expect(paths).toContain('public/assets/logo.png');
  });

  test('includes size info', () => {
    const results = [];
    scanDir(path.join(TMP_DIR, 'dist'), TMP_DIR, results);
    for (const r of results) {
      expect(r.size).toBeGreaterThan(0);
      expect(r.fullPath).toBeTruthy();
    }
  });
});
