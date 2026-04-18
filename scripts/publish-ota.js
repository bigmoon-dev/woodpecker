const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SCAN_DIRS = ['dist', 'public'];

function validateSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function scanDir(dir, baseDir, results) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, baseDir, results);
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ path: relPath, fullPath, size: stat.size });
    }
  }
}

function generateManifest(version, baseDir, scanDirs) {
  const files = {};
  let totalSize = 0;

  for (const dir of scanDirs) {
    const fullDir = path.join(baseDir, dir);
    if (!fs.existsSync(fullDir)) {
      console.warn(`  警告: ${dir}/ 不存在，跳过`);
      continue;
    }
    const items = [];
    scanDir(fullDir, baseDir, items);
    for (const item of items) {
      const hash = computeFileHash(item.fullPath);
      files[item.path] = { hash, size: item.size };
      totalSize += item.size;
    }
  }

  return {
    version,
    releaseDate: new Date().toISOString().split('T')[0],
    target: 'common',
    files,
    totalSize,
    fileCount: Object.keys(files).length,
  };
}

function signManifest(manifest, privateKeyPath) {
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const { signature, ...data } = manifest;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(JSON.stringify(data));
  return sign.sign(privateKey, 'base64');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('用法: node publish-ota.js <版本号> [--skip-build] [--skip-upload]');
    console.log('示例: node publish-ota.js 0.23.0');
    console.log('');
    console.log('选项:');
    console.log('  --skip-build    跳过前后端构建');
    console.log('  --skip-upload   跳过 SCP 上传');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const NEW_VERSION = args[0];
  const SKIP_BUILD = args.includes('--skip-build');
  const SKIP_UPLOAD = args.includes('--skip-upload');
  const BASE_DIR = path.resolve(__dirname, '..');
  const UPDATE_DIR = path.join(BASE_DIR, 'update-server');
  const VERSION_DIR = path.join(UPDATE_DIR, NEW_VERSION);
  const FILES_DIR = path.join(VERSION_DIR, 'files');
  const PRIVATE_KEY_PATH = path.join(__dirname, 'ota-keys', 'private.key');
  const OTA_BASE_URL = 'https://bigmoon.top/woodpecker/updates';

  if (!validateSemver(NEW_VERSION)) {
    console.error(`错误: 无效版本号格式 "${NEW_VERSION}"，需要 semver (x.y.z)`);
    process.exit(1);
  }

  console.log('====================================');
  console.log('  啄木鸟 OTA 增量更新发布脚本');
  console.log('====================================\n');
  console.log(`新版本: ${NEW_VERSION}\n`);

  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('错误: 找不到私钥文件 scripts/ota-keys/private.key');
    process.exit(1);
  }

  const packagePath = path.join(BASE_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.version === NEW_VERSION && !SKIP_BUILD) {
    console.error(`错误: package.json 版本已是 ${NEW_VERSION}，请先更新版本号`);
    process.exit(1);
  }

  const step = (n, total, msg) => console.log(`[${n}/${total}] ${msg}...`);
  const TOTAL_STEPS = SKIP_BUILD ? 5 : 7;
  let currentStep = 0;

  if (!SKIP_BUILD) {
    step(++currentStep, TOTAL_STEPS, '更新版本号');
    pkg.version = NEW_VERSION;
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✅ package.json → ${NEW_VERSION}\n`);

    step(++currentStep, TOTAL_STEPS, '构建前端');
    execSync('npx vite build', { cwd: path.join(BASE_DIR, 'client'), stdio: 'inherit' });
    console.log('  ✅ 前端构建完成\n');

    step(++currentStep, TOTAL_STEPS, '构建后端');
    execSync('npm run build', { cwd: BASE_DIR, stdio: 'inherit' });
    console.log('  ✅ 后端构建完成\n');
  }

  step(++currentStep, TOTAL_STEPS, '生成文件清单');
  const manifest = generateManifest(NEW_VERSION, BASE_DIR, SCAN_DIRS);
  console.log(`  ✅ 扫描到 ${manifest.fileCount} 个文件，总大小 ${formatBytes(manifest.totalSize)}\n`);

  step(++currentStep, TOTAL_STEPS, '签名 manifest');
  const signature = signManifest(manifest, PRIVATE_KEY_PATH);
  manifest.signature = signature;
  console.log('  ✅ RSA-SHA256 签名完成\n');

  step(++currentStep, TOTAL_STEPS, '创建版本目录');
  fs.mkdirSync(FILES_DIR, { recursive: true });
  for (const [relPath] of Object.entries(manifest.files)) {
    const srcPath = path.join(BASE_DIR, relPath);
    const destPath = path.join(FILES_DIR, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
  fs.writeFileSync(
    path.join(VERSION_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`  ✅ 文件已复制到 ${VERSION_DIR}\n`);

  step(++currentStep, TOTAL_STEPS, '生成 version.json');
  const versionInfo = {
    version: NEW_VERSION,
    releaseDate: new Date().toISOString().split('T')[0],
    minVersion: '0.22.0',
    channel: 'stable',
    manifestUrl: `${OTA_BASE_URL}/${NEW_VERSION}/manifest.json`,
    notes: '',
    size: {
      common: manifest.totalSize,
    },
  };
  fs.writeFileSync(
    path.join(UPDATE_DIR, 'version.json'),
    JSON.stringify(versionInfo, null, 2)
  );
  console.log('  ✅ version.json 已生成\n');

  if (!SKIP_UPLOAD) {
    step(++currentStep, TOTAL_STEPS, '上传到服务器');
    const remoteBase = 'root@bigmoon.top:/var/www/woodpecker/updates';
    execSync(`ssh root@bigmoon.top "mkdir -p /var/www/woodpecker/updates/${NEW_VERSION}/files"`, { stdio: 'inherit' });
    execSync(`scp ${UPDATE_DIR}/version.json ${remoteBase}/version.json`, { stdio: 'inherit' });
    execSync(`scp ${VERSION_DIR}/manifest.json ${remoteBase}/${NEW_VERSION}/manifest.json`, { stdio: 'inherit' });
    execSync(`scp -r ${FILES_DIR}/* ${remoteBase}/${NEW_VERSION}/files/`, { stdio: 'inherit' });
    console.log('  ✅ 上传完成\n');

    console.log('验证部署...');
    try {
      execSync(`curl -sf ${OTA_BASE_URL}/version.json | head -5`, { stdio: 'inherit' });
      console.log('  ✅ 部署验证通过\n');
    } catch {
      console.warn('  ⚠️  验证失败，请手动检查\n');
    }
  } else {
    console.log('  ⏭️  跳过上传\n');
  }

  console.log('====================================');
  console.log(`  发布完成: v${NEW_VERSION}`);
  console.log('====================================');
  console.log(`  文件数: ${manifest.fileCount}`);
  console.log(`  大小: ${formatBytes(manifest.totalSize)}`);
  console.log(`  本地: ${VERSION_DIR}`);
  if (!SKIP_UPLOAD) {
    console.log(`  远程: ${OTA_BASE_URL}/${NEW_VERSION}/`);
  }
  console.log('');
}

module.exports = {
  validateSemver,
  computeFileHash,
  generateManifest,
  signManifest,
  formatBytes,
  scanDir,
};

if (require.main === module) {
  main();
}
