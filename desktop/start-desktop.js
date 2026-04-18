const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const APP_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(APP_DIR, 'data');
const DB_DATA_DIR = path.join(DATA_DIR, 'db');
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

    await client.query(`
      INSERT INTO "users" ("id", "username", "password", "displayName", "status")
      VALUES (gen_random_uuid(), 'admin', '$2b$10$6fpCy6AzEnC0frnktI0HS./nAmn1OAPWxn/q7593h8w92LI83T8OS', '系统管理员', 'active')
      ON CONFLICT ("username") DO NOTHING
    `);

    const roles = ['系统管理员', '心理老师', '班主任', '学生'];
    for (const name of roles) {
      await client.query(`INSERT INTO "roles" ("id", "name", "description", "isSystem") VALUES (gen_random_uuid(), $1, $1, true) ON CONFLICT ("name") DO NOTHING`, [name]);
    }

    const adminRole = await client.query(`SELECT "id" FROM "roles" WHERE "name" = '系统管理员' LIMIT 1`);
    const adminUser = await client.query(`SELECT "id" FROM "users" WHERE "username" = 'admin' LIMIT 1`);
    if (adminRole.rows.length > 0 && adminUser.rows.length > 0) {
      await client.query(`INSERT INTO "user_roles" ("userId", "roleId") VALUES ($1, $2) ON CONFLICT ("userId", "roleId") DO NOTHING`, [adminUser.rows[0].id, adminRole.rows[0].id]);
    }

    console.log('  ✅ 初始数据已插入');
  } catch {
    // tables might not exist yet if DB_SYNC hasn't run
  } finally {
    try { await client.end(); } catch {}
  }
}

async function main() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   啄木鸟心理预警辅助系统 - 正在启动...    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  if (!fs.existsSync(DB_DATA_DIR)) {
    fs.mkdirSync(DB_DATA_DIR, { recursive: true });
  }

  console.log('[1/4] 启动内置数据库...');
  const pg = new EmbeddedPostgres({
    database: 'postgres',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    dataDir: DB_DATA_DIR,
  });

  const isFresh = !fs.existsSync(path.join(DB_DATA_DIR, 'PG_VERSION'));
  if (isFresh) {
    console.log('  首次启动，初始化数据库引擎...');
    await pg.initialise();
  }
  await pg.start();

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

  console.log('[2/4] 准备数据库...');
  await ensureDatabase();
  console.log('  ✅ 数据库就绪');

  console.log('[3/4] 启动应用服务...');
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
    JWT_SECRET: 'woodpecker-desktop-jwt-secret',
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

  console.log('[4/4] 等待应用就绪...');
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
    console.log('║  默认账号: admin                          ║');
    console.log('║  默认密码: admin123                       ║');
    console.log('║  关闭此窗口将停止服务                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
  } catch {
    console.log('');
    console.log('  ⚠️  应用可能未完全启动');
    console.log(`  请手动访问: ${appUrl}`);
    console.log('  账号: admin / admin123');
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
