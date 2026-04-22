const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const _config = {
  appDir: path.resolve(__dirname, '..'),
  baseUrl: process.env.OTA_BASE_URL || '',
  scanDirs: ['dist', 'public', 'desktop'],
  maxBackups: 2,
  defaultTimeout: 10000,
};

function _getConfig() {
  if (!_config.baseUrl && process.env.OTA_BASE_URL) {
    _config.baseUrl = process.env.OTA_BASE_URL;
  }
  return _config;
}

function _versionFile() { return path.join(_getConfig().appDir, 'version.json'); }
function _pendingFile() { return path.join(_getConfig().appDir, '.pending-version'); }
function _backupDir() { return path.join(_getConfig().appDir, 'backup'); }

function configure(opts) {
  Object.assign(_config, opts);
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function getCurrentVersion() {
  try {
    const vf = _versionFile();
    if (fs.existsSync(vf)) {
      const data = JSON.parse(fs.readFileSync(vf, 'utf8'));
      if (data.version) return data.version;
    }
  } catch {}
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(_getConfig().appDir, 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch {}
  return null;
}

function setCurrentVersion(version, extra) {
  const data = {
    version,
    lastChecked: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(_versionFile(), JSON.stringify(data, null, 2));
}

function fetchJson(url, timeout) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: timeout || _getConfig().defaultTimeout }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      fetchJson(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function fetchBinary(url, timeout) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: timeout || _getConfig().defaultTimeout }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      fetchBinary(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function verifyManifest(manifest, publicKeyPem) {
  const pubKey = publicKeyPem || _config.publicKeyPem || fs.readFileSync(
    path.join(__dirname, 'ota-keys', 'public.key'), 'utf8'
  );
  const { signature, ...data } = manifest;
  if (!signature) return false;
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(JSON.stringify(data));
  return verify.verify(pubKey, signature, 'base64');
}

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getLocalFileHashes() {
  const hashes = {};
  for (const dir of _getConfig().scanDirs) {
    const fullDir = path.join(_getConfig().appDir, dir);
    if (!fs.existsSync(fullDir)) continue;
    _scanDir(fullDir, dir, hashes);
  }
  return hashes;
}

function _scanDir(dir, prefix, hashes) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      _scanDir(fullPath, `${prefix}/${item}`, hashes);
    } else {
      const rel = `${prefix}/${item}`;
      hashes[rel] = { hash: computeFileHash(fullPath), size: stat.size };
    }
  }
}

function computeDiff(localHashes, remoteManifest) {
  const diff = [];
  const remoteFiles = remoteManifest.files || {};
  for (const [relPath, info] of Object.entries(remoteFiles)) {
    const local = localHashes[relPath];
    if (!local || local.hash !== info.hash) {
      diff.push({ path: relPath, hash: info.hash, size: info.size });
    }
  }
  return diff;
}

async function checkForUpdate() {
  const currentVersion = getCurrentVersion();
  if (!currentVersion) return null;
  const versionInfo = await fetchJson(`${_getConfig().baseUrl}/version.json`);
  if (!versionInfo || !versionInfo.version) return null;
  if (compareVersions(versionInfo.version, currentVersion) <= 0) return null;
  if (versionInfo.minVersion && compareVersions(currentVersion, versionInfo.minVersion) < 0) {
    return { ...versionInfo, needsFullUpdate: true };
  }
  return { ...versionInfo, needsFullUpdate: false };
}

async function getUpdateFiles(manifestUrl) {
  const manifest = await fetchJson(manifestUrl);
  if (!verifyManifest(manifest)) {
    throw new Error('Manifest signature verification failed');
  }
  const localHashes = getLocalFileHashes();
  const diff = computeDiff(localHashes, manifest);
  return { manifest, diff };
}

function fetchBinaryWithProgress(url, timeout, onChunk) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
  const req = mod.get(url, { timeout: timeout || _getConfig().defaultTimeout }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      fetchBinaryWithProgress(res.headers.location, timeout, onChunk).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => {
        chunks.push(c);
        if (onChunk) onChunk(c.length);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function downloadFiles(version, diffFiles, onProgress) {
  const buffers = [];
  let downloaded = 0;
  const totalSize = diffFiles.reduce((s, f) => s + f.size, 0);

  for (const file of diffFiles) {
    const url = `${_getConfig().baseUrl}/${version}/files/${file.path}`;
    const buf = await fetchBinaryWithProgress(url, _getConfig().defaultTimeout, (chunkSize) => {
      downloaded += chunkSize;
      if (onProgress) onProgress(downloaded, totalSize, file.path);
    });
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (hash !== file.hash) {
      throw new Error(`Hash mismatch for ${file.path}: expected ${file.hash}, got ${hash}`);
    }
    buffers.push({ path: file.path, buffer: buf });
  }
  return buffers;
}

function backupCurrent(diffFiles) {
  const currentVersion = getCurrentVersion() || 'unknown';
  const backupPath = path.join(_backupDir(), currentVersion);
  if (fs.existsSync(backupPath)) {
    fs.rmSync(backupPath, { recursive: true });
  }
  fs.mkdirSync(backupPath, { recursive: true });

  for (const file of diffFiles) {
    const srcPath = path.join(_getConfig().appDir, file.path);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(backupPath, file.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
  _cleanupOldBackups();
  return backupPath;
}

function _cleanupOldBackups() {
  const bdir = _backupDir();
  if (!fs.existsSync(bdir)) return;
  const versions = fs.readdirSync(bdir)
    .filter((name) => {
      try {
        return fs.statSync(path.join(bdir, name)).isDirectory();
      } catch { return false; }
    })
    .sort((a, b) => compareVersions(b, a));

  while (versions.length > _getConfig().maxBackups) {
    const old = versions.pop();
    fs.rmSync(path.join(bdir, old), { recursive: true });
  }
}

function applyUpdate(buffers) {
  for (const { path: relPath, buffer } of buffers) {
    const destPath = path.join(_getConfig().appDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
  }
}

function setPendingVersion(version) {
  fs.writeFileSync(_pendingFile(), version);
}

function finalizePendingVersion() {
  const pf = _pendingFile();
  if (fs.existsSync(pf)) {
    const version = fs.readFileSync(pf, 'utf8').trim();
    fs.unlinkSync(pf);
    setCurrentVersion(version);
    return version;
  }
  return null;
}

function rollback(backupVersion) {
  const backupPath = path.join(_backupDir(), backupVersion);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupVersion}`);
  }
  _restoreDir(backupPath, _getConfig().appDir);
  setCurrentVersion(backupVersion);
}

function _restoreDir(src, dest) {
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item === 'backup') continue;
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      _restoreDir(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = {
  compareVersions,
  configure,
  getCurrentVersion,
  setCurrentVersion,
  checkForUpdate,
  getUpdateFiles,
  downloadFiles,
  applyUpdate,
  backupCurrent,
  rollback,
  verifyManifest,
  getLocalFileHashes,
  computeDiff,
  computeFileHash,
  setPendingVersion,
  finalizePendingVersion,
  fetchJson,
  fetchBinary,
  _config,
};
