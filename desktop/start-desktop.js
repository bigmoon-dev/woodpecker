const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const readline = require('readline');
const crypto = require('crypto');
const ota = require('./ota-client');

const APP_DIR = path.resolve(__dirname, '..');

function getUserDataDir() {
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
}

const DATA_DIR = getUserDataDir();
const DB_DATA_DIR = path.join(DATA_DIR, 'db');
const MIGRATION_MARKER = path.join(DATA_DIR, '.data-dir-migrated');
const PG_PORT = 15432;
const APP_PORT = 3000;
const DB_NAME = 'psych_scale';

function getNodePath() {
  const platform = os.platform();
  const bundledNode = platform === 'win32'
    ? path.join(APP_DIR, 'node', 'node.exe')
    : path.join(APP_DIR, 'node', 'node');
  if (fs.existsSync(bundledNode)) return bundledNode;
  return process.execPath;
}

function waitUntilReady(url, maxRetries = 60) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      http.get(url, (res) => {
        resolve(true);
      }).on('error', () => {
        tries++;
        if (tries >= maxRetries) reject(new Error(`服务未在 ${maxRetries} 秒内启动`));
        else setTimeout(check, 1000);
      });
    };
    setTimeout(check, 1000);
  });
}

function openBrowser(url) {
  const platform = os.platform();
  let cmd;
  if (platform === 'win32') cmd = 'start';
  else if (platform === 'darwin') cmd = 'open';
  else cmd = 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', shell: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function checkAndApplyOta() {
  try {
    console.log('  正在检查更新...');
    const currentVersion = ota.getCurrentVersion();
    console.log(`  当前版本: ${currentVersion || '未知'}`);

    let updateInfo;
    try {
      updateInfo = await ota.checkForUpdate();
    } catch (err) {
      console.log(`  ⚠️  检查更新失败: ${err.message}`);
      return false;
    }

    if (!updateInfo) {
      console.log('  ✅ 当前已是最新版本');
      return false;
    }

    if (updateInfo.needsFullUpdate) {
      console.log(`  ⚠️  发现新版本 ${updateInfo.version}，需要下载全量安装包`);
      return false;
    }

    const sizeInfo = updateInfo.size?.common ? ` (${formatBytes(updateInfo.size.common)})` : '';
    console.log(`  📦 发现新版本 ${updateInfo.version}（当前 ${ota.getCurrentVersion()}）${sizeInfo}`);
    if (updateInfo.notes) {
      console.log(`     更新说明: ${updateInfo.notes}`);
    }

    const answer = await askQuestion('  是否更新? [Y/n] ');
    if (answer && answer.toLowerCase() !== 'y') {
      console.log('  已跳过更新');
      return false;
    }

    console.log('  正在获取更新清单...');
    const manifestUrl = `${ota._config.baseUrl}/${updateInfo.version}/manifest.json`;
    const { manifest, diff } = await ota.getUpdateFiles(manifestUrl);
    if (diff.length === 0) {
      console.log('  ✅ 所有文件已是最新，更新版本号');
      ota.setCurrentVersion(updateInfo.version);
      return false;
    }

    const diffSize = diff.reduce((s, f) => s + f.size, 0);
    console.log(`  📋 需要更新 ${diff.length} 个文件 (${formatBytes(diffSize)})`);

    console.log('  💾 正在备份当前版本...');
    ota.backupCurrent(diff);
    console.log('  ✅ 备份完成');

    console.log(`  ⬇️  正在下载更新...`);
    let lastFile = '';
    const buffers = await ota.downloadFiles(updateInfo.version, diff, (downloaded, total, currentFile) => {
      const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
      const shortFile = currentFile ? currentFile.replace(/^.*[\/]/, '') : '';
      process.stdout.write(`\r  [${bar}] ${pct}% (${formatBytes(downloaded)}/${formatBytes(total)}) ${shortFile}          `);
    });
    console.log('');
    console.log('  ✅ 下载完成');

    console.log('  📝 正在应用更新...');
    for (let i = 0; i < buffers.length; i++) {
      const shortPath = buffers[i].path.replace(/^.*[\/]/, '');
      process.stdout.write(`\r  写入文件 (${i + 1}/${buffers.length}): ${shortPath}          `);
      fs.mkdirSync(path.dirname(path.join(APP_DIR, buffers[i].path)), { recursive: true });
      fs.writeFileSync(path.join(APP_DIR, buffers[i].path), buffers[i].buffer);
    }
    console.log('');
    console.log('  ✅ 更新已应用');

    ota.setPendingVersion(updateInfo.version);
    console.log(`  🎉 已更新到 v${updateInfo.version}，正在重启服务...`);
    return true;
  } catch (err) {
    console.log('');
    console.log(`  ❌ 更新失败: ${err.message}`);
    return false;
  }
}

async function ensureDatabase() {
  const { Client } = require('pg');
  const client = new Client({
    host: 'localhost',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();

  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [DB_NAME]
  );

  if (result.rows.length === 0) {
    console.log('  首次启动，创建数据库...');
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log('  ✅ 数据库创建成功');
  } else {
    console.log('  ✅ 数据库已存在');
  }
  await client.end();
}

async function seedIfEmpty() {
  const { Client } = require('pg');
  const client = new Client({
    host: 'localhost',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    database: DB_NAME,
  });

  try {
    await client.connect();

    const check = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`);
    if (check.rows.length === 0) return;

    const userCheck = await client.query(`SELECT 1 FROM "users" WHERE "username" = 'admin' LIMIT 1`);
    if (userCheck.rows.length > 0) return;

    console.log('  首次启动，插入初始数据...');

    const roles = [
      { name: 'admin', desc: '系统管理员' },
      { name: 'psychologist', desc: '心理老师' },
      { name: 'teacher', desc: '班主任' },
      { name: 'student', desc: '学生' },
    ];
    const roleIds = {};
    for (const role of roles) {
      const res = await client.query(
        `INSERT INTO "roles" ("id", "name", "description", "isSystem") VALUES (gen_random_uuid(), $1, $2, true) ON CONFLICT ("name") DO UPDATE SET "description" = $2 RETURNING "id"`,
        [role.name, role.desc]
      );
      roleIds[role.name] = res.rows[0].id;
    }

    const permissions = [
      { code: 'scale:read', name: '查看量表', category: 'scale' },
      { code: 'scale:write', name: '管理量表', category: 'scale' },
      { code: 'scale:delete', name: '删除量表', category: 'scale' },
      { code: 'task:read', name: '查看任务', category: 'task' },
      { code: 'task:write', name: '管理任务', category: 'task' },
      { code: 'task:delete', name: '删除任务', category: 'task' },
      { code: 'result:read', name: '查看结果', category: 'result' },
      { code: 'result:write', name: '管理结果', category: 'result' },
      { code: 'alert:read', name: '查看预警', category: 'alert' },
      { code: 'alert:write', name: '管理预警', category: 'alert' },
      { code: 'followup:read', name: '查看随访', category: 'followup' },
      { code: 'followup:write', name: '管理随访', category: 'followup' },
      { code: 'admin:all', name: '全部管理权限', category: 'admin' },
      { code: 'dashboard:read', name: '查看仪表盘', category: 'dashboard' },
      { code: 'interview:read', name: '查看访谈', category: 'interview' },
      { code: 'interview:write', name: '管理访谈', category: 'interview' },
      { code: 'export:read', name: '数据导出', category: 'export' },
      { code: 'student:read', name: '查看学生', category: 'student' },
      { code: 'student:write', name: '管理学生', category: 'student' },
      { code: 'user:read', name: '查看用户', category: 'user' },
      { code: 'user:write', name: '管理用户', category: 'user' },
      { code: 'role:read', name: '查看角色', category: 'role' },
      { code: 'role:write', name: '管理角色', category: 'role' },
      { code: 'plugin:read', name: '查看插件', category: 'plugin' },
      { code: 'plugin:write', name: '管理插件', category: 'plugin' },
      { code: 'config:read', name: '查看配置', category: 'config' },
      { code: 'config:write', name: '管理配置', category: 'config' },
      { code: 'consent:read', name: '查看知情同意', category: 'consent' },
      { code: 'consent:write', name: '管理知情同意', category: 'consent' },
      { code: 'audit:read', name: '查看审计日志', category: 'audit' },
    ];
    for (const perm of permissions) {
      await client.query(
        `INSERT INTO "permissions" ("id", "code", "name", "category") VALUES (gen_random_uuid(), $1, $2, $3) ON CONFLICT ("code") DO NOTHING`,
        [perm.code, perm.name, perm.category]
      );
    }

    const adminPerms = await client.query(`SELECT "id" FROM "permissions"`);
    const psychologistPerms = await client.query(
      `SELECT "id" FROM "permissions" WHERE "code" NOT IN ('admin:all', 'role:write', 'config:write', 'plugin:write')`
    );

    for (const permRow of adminPerms.rows) {
      await client.query(
        `INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
        [roleIds['admin'], permRow.id]
      );
    }
    for (const permRow of psychologistPerms.rows) {
      await client.query(
        `INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
        [roleIds['psychologist'], permRow.id]
      );
    }

    const users = [
      { username: 'admin', password: '$2b$10$6fpCy6AzEnC0frnktI0HS./nAmn1OAPWxn/q7593h8w92LI83T8OS', displayName: '系统管理员' },
      { username: '张毛毛', password: '$2b$10$6AENzM1tdUjK1JwFcUpvbOloyn9tPKpFscWoh/L22mIGqYkcWtzDy', displayName: '张毛毛' },
    ];
    const userIds = {};
    for (const u of users) {
      const res = await client.query(
        `INSERT INTO "users" ("id", "username", "password", "displayName", "status") VALUES (gen_random_uuid(), $1, $2, $3, 'active') ON CONFLICT ("username") DO NOTHING RETURNING "id"`,
        [u.username, u.password, u.displayName]
      );
      if (res.rows.length > 0) {
        userIds[u.username] = res.rows[0].id;
      }
    }

    if (userIds['admin'] && roleIds['admin']) {
      await client.query(
        `INSERT INTO "user_roles" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userIds['admin'], roleIds['admin']]
      );
    }
    if (userIds['张毛毛'] && roleIds['psychologist']) {
      await client.query(
        `INSERT INTO "user_roles" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userIds['张毛毛'], roleIds['psychologist']]
      );
    }

    console.log('  ✅ 初始数据已插入');
    console.log('     管理员: admin / admin123');
    console.log('     心理老师: 张毛毛 / Abc12345');
  } catch (e) {
    console.log('  ⚠️ 种子数据插入失败:', e.message);
  } finally {
    try { await client.end(); } catch {}
  }
}

async function ensureDataDir() {
  const oldDataDir = path.join(APP_DIR, 'data');
  if (!fs.existsSync(MIGRATION_MARKER) && fs.existsSync(oldDataDir) && fs.existsSync(path.join(oldDataDir, 'db', 'PG_VERSION'))) {
    console.log('  📦 检测到旧版数据目录，正在迁移...');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const entries = fs.readdirSync(oldDataDir);
    for (const entry of entries) {
      const src = path.join(oldDataDir, entry);
      const dest = path.join(DATA_DIR, entry);
      if (!fs.existsSync(dest)) {
        fs.cpSync(src, dest, { recursive: true });
      }
    }
    fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
    console.log(`  ✅ 数据已迁移到 ${DATA_DIR}`);
  }

  if (!fs.existsSync(DB_DATA_DIR)) {
    fs.mkdirSync(DB_DATA_DIR, { recursive: true });
  }
}

async function main() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   啄木鸟心理预警辅助系统 - 正在启动...    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  数据目录: ${DATA_DIR}`);
  console.log('');

  await ensureDataDir();

  console.log('[1/5] 启动内置数据库...');
  const pg = new EmbeddedPostgres({
    database: 'postgres',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    databaseDir: DB_DATA_DIR,
  });

  const isFresh = !fs.existsSync(path.join(DB_DATA_DIR, 'PG_VERSION'));
  if (isFresh) {
    console.log('  首次启动，初始化数据库引擎...');
    await pg.initialise();
  }
  await pg.start();

  const finalized = ota.finalizePendingVersion();
  if (finalized) {
    console.log(`  ✅ OTA 更新已完成: v${finalized}`);
  }

  let waited = 0;
  while (waited < 10) {
    try {
      const { Client } = require('pg');
      const c = new Client({ host: 'localhost', port: PG_PORT, user: 'postgres', password: 'postgres', database: 'postgres' });
      await c.connect();
      await c.end();
      break;
    } catch {
      await sleep(1000);
      waited++;
    }
  }
  console.log('  ✅ 数据库引擎就绪');

  console.log('[2/5] 准备数据库...');
  await ensureDatabase();
  console.log('  ✅ 数据库就绪');

  console.log('[3/5] 检查更新...');
  const otaConfigPath = path.join(APP_DIR, 'desktop', 'ota-config.json');
  if (fs.existsSync(otaConfigPath)) {
    try {
      const otaConfig = JSON.parse(fs.readFileSync(otaConfigPath, 'utf8'));
      if (otaConfig.baseUrl) ota.configure({ baseUrl: otaConfig.baseUrl });
    } catch {}
  }
  const needsRestart = await checkAndApplyOta();

  console.log('[4/5] 启动应用服务...');
  const env = {
    ...process.env,
    PORT: String(APP_PORT),
    DB_HOST: 'localhost',
    DB_PORT: String(PG_PORT),
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'postgres',
    DB_DATABASE: DB_NAME,
    DB_SYNC: 'true',
    DB_LOGGING: 'false',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    ENCRYPTION_KEY: 'woodpecker-desktop-encryption-key',
    AUDIT_HMAC_SECRET: 'woodpecker-desktop-hmac-secret',
    NODE_ENV: 'production',
  };

  const nodePath = getNodePath();
  const mainJs = path.join(APP_DIR, 'dist', 'main.js');

  if (!fs.existsSync(mainJs)) {
    console.error('  ❌ 未找到应用文件: dist/main.js');
    console.error('  请确认已完成构建（npm run build）');
    try { await pg.stop(); } catch {}
    process.exit(1);
  }

  const app = spawn(nodePath, [mainJs], {
    cwd: APP_DIR,
    env,
    stdio: 'inherit',
  });

  app.on('error', (err) => {
    console.error('  ❌ 应用启动失败:', err.message);
    try { pg.stop(); } catch {}
    process.exit(1);
  });

  app.on('exit', (code) => {
    if (code && code !== 0) {
      console.error('  ❌ 应用异常退出，代码:', code);
      try { pg.stop(); } catch {}
      process.exit(code);
    }
  });

  console.log('[5/5] 等待应用就绪...');
  const appUrl = `http://localhost:${APP_PORT}`;
  try {
    await waitUntilReady(`${appUrl}/health`, 60);
    await seedIfEmpty();
    openBrowser(appUrl);
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║          ✅ 启动成功！                    ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  访问地址: ${appUrl.padEnd(28)}║`);
    console.log('║  管理员: admin / admin123                ║');
    console.log('║  心理老师: 张毛毛 / Abc12345              ║');
    console.log('║  关闭此窗口将停止服务                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
  } catch {
    console.log('');
    console.log('  ⚠️  应用可能未完全启动');
    console.log(`  请手动访问: ${appUrl}`);
    console.log('  管理员: admin / admin123');
    console.log('  心理老师: 张毛毛 / Abc12345');
    console.log('');
  }

  const shutdown = async (signal) => {
    console.log('');
    console.log(`收到 ${signal} 信号，正在关闭...`);
    app.kill('SIGTERM');
    setTimeout(() => {
      try { app.kill('SIGKILL'); } catch {}
    }, 5000);
    try { await pg.stop(); } catch {}
    console.log('已安全关闭');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  if (os.platform() === 'win32') {
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  }
}

main().catch((err) => {
  console.error('');
  console.error('❌ 启动失败:', err.message);
  console.error('');
  process.exit(1);
});
