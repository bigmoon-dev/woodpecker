#!/usr/bin/env node

/**
 * SCL-90 黑盒测试 — 仅答题提交部分
 * 使用已有的旧班级(65c97161) + 旧任务(7e2b315c) + 旧量表(216cb30b)
 * stu7_01~30 用户已存在，studentId 指向旧班级学生
 */

const http = require('http');
const { Client } = require('pg');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = new Error(
            `HTTP ${res.statusCode} ${method} ${path}: ${data.substring(0, 300)}`,
          );
          err.statusCode = res.statusCode;
          err.body = data;
          reject(err);
        } else {
          resolve(data ? JSON.parse(data) : null);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const post = (path, body, token) => request('POST', path, body, token);
const get = (path, token) => request('GET', path, null, token);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDbClient() {
  const dotenv = require('dotenv');
  dotenv.config({ path: '/home/maxin/project/psych-scale-server/.env' });
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_DATABASE || 'psych_scale',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
  await client.connect();
  const encKey = process.env.ENCRYPTION_KEY || 'change-this-to-a-secure-key-in-production';
  await client.query(`SET app.encryption_key = '${encKey.replace(/'/g, "''")}'`);
  return client;
}

const TASK_ID = '7e2b315c-5045-4518-85d4-ca72e453fcc2';
const SCALE_ID = '216cb30b-6f93-43ab-8ec1-6d46abb8be6b';

async function main() {
  console.log('=== SCL-90 答题提交 (使用已有资源) ===\n');

  const db = await getDbClient();

  // Step 1: Load scale items and options
  console.log('Step 1: 加载量表题目...');
  const items = await db.query(
    'SELECT si.id, si."sortOrder" FROM scale_items si WHERE si."scaleId" = $1 ORDER BY si."sortOrder"',
    [SCALE_ID],
  );
  const itemIds = items.rows.map((r) => r.id);
  console.log(`  ${itemIds.length} 题`);

  const allOpts = await db.query(
    'SELECT id, "itemId", "scoreValue" FROM scale_options WHERE "itemId" = ANY($1)',
    [itemIds],
  );
  const optsByItem = {};
  allOpts.rows.forEach((o) => {
    if (!optsByItem[o.itemId]) optsByItem[o.itemId] = {};
    optsByItem[o.itemId][o.scoreValue] = o.id;
  });
  console.log(`  ${allOpts.rows.length} 个选项`);

  // Step 2: Get all stu7 users with their studentIds
  console.log('\nStep 2: 获取学生用户...');
  const users = await db.query(
    "SELECT id, username, \"studentId\" FROM users WHERE username LIKE 'stu7_%' ORDER BY username",
  );
  console.log(`  ${users.rows.length} 个用户`);
  if (users.rows.length !== 30) {
    console.error('  错误：应有30个用户');
    process.exit(1);
  }

  // Step 3: Create consent records via DB (if not exist)
  console.log('\nStep 3: 创建知情同意记录...');
  for (const user of users.rows) {
    const existing = await db.query(
      'SELECT id FROM consent_records WHERE "userId" = $1 AND "consentType" = $2',
      [user.id, 'assessment'],
    );
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO consent_records (id, "userId", "studentId", "consentType", "contentHash", "signedAt")
         VALUES (uuid_generate_v4(), $1, $2, 'assessment', 'e2e-test-v3', NOW())`,
        [user.id, user.studentId],
      );
      console.log(`  ${user.username}: 已签署`);
    } else {
      console.log(`  ${user.username}: 已存在`);
    }
  }

  // Step 4: Login admin + psych to verify server is up
  console.log('\nStep 4: 验证服务...');
  const adminToken = await post('/auth/login', { username: 'admin', password: 'admin123' });
  console.log('  Admin login: OK');
  await sleep(12000);
  const psychToken = await post('/auth/login', { username: 'zhangmm', password: 'Mm123456' });
  console.log('  Psychologist login: OK');

  // Step 5: Submit answers for each student
  console.log('\nStep 5: 30个学生按规则答题...');
  console.log('  Group A (1-10): 全选"没有" (scoreValue=1)');
  console.log('  Group B (11-20): 奇数选"很轻"(2), 偶数选"中等"(3)');
  console.log('  Group C (21-30): 全选"偏重" (scoreValue=4)');

  const colorCounts = { green: 0, yellow: 0, red: 0, gray: 0, other: 0 };
  const alertList = [];

  for (let i = 0; i < 30; i++) {
    const user = users.rows[i];
    const group = i < 10 ? 'A' : i < 20 ? 'B' : 'C';

    if (i > 0 || true) {
      console.log(`  [等待13秒避免限流...]`);
      await sleep(13000);
    }

    let studentToken;
    try {
      studentToken = (await post('/auth/login', { username: user.username, password: 'Test1234' })).accessToken;
    } catch (e) {
      console.log(`  ${user.username} [${group}]: 登录失败 — ${e.message.substring(0, 120)}`);
      continue;
    }

    const answers = itemIds.map((itemId) => {
      let targetScore;
      if (i < 10) {
        targetScore = 1;
      } else if (i < 20) {
        targetScore = i % 2 === 0 ? 2 : 3;
      } else {
        targetScore = 4;
      }
      const optionId = optsByItem[itemId][targetScore];
      return { itemId, optionId };
    });

    try {
      const result = await post(`/tasks/${TASK_ID}/answers/submit`, { items: answers }, studentToken);
      const color = result.color || 'unknown';
      colorCounts[color] = (colorCounts[color] || 0) + 1;
      console.log(`  ${user.username} [${group}]: total=${result.totalScore?.toFixed(2)}, color=${color}, level=${result.level}`);
      if (color === 'red' || color === 'yellow') {
        alertList.push({ name: user.username, color, level: result.level });
      }
    } catch (e) {
      console.log(`  ${user.username} [${group}]: 提交失败 — ${e.message.substring(0, 200)}`);
    }
  }

  // Step 6: Verify
  console.log('\n=== 验证结果 ===');
  console.log(`\n评分分布:`);
  console.log(`  Green (正常): ${colorCounts.green}`);
  console.log(`  Yellow (轻度): ${colorCounts.yellow}`);
  console.log(`  Red (中重度): ${colorCounts.red}`);
  console.log(`  Gray/Other: ${(colorCounts.gray || 0) + (colorCounts.other || 0)}`);

  console.log(`\n预警触发 (${alertList.length}条):`);
  alertList.forEach((a) => console.log(`  ${a.color === 'red' ? '🔴' : '🟡'} ${a.name} — ${a.level}`));

  await sleep(3000);
  try {
    const alerts = await get('/alerts', psychToken);
    const alertData = Array.isArray(alerts) ? alerts : (alerts.data || []);
    console.log(`\n预警API记录: ${alertData.length}条`);
  } catch (e) {
    console.log(`\n预警API查询失败: ${e.message.substring(0, 100)}`);
  }

  try {
    const overview = await get('/dashboard/overview', psychToken);
    console.log(`\nDashboard: ${JSON.stringify(overview)}`);
  } catch (e) {
    console.log(`\nDashboard查询失败: ${e.message.substring(0, 100)}`);
  }

  // Check DB results
  const results = await db.query(
    `SELECT r.id, r."studentId", r."totalScore", r.color, r.level FROM task_results r WHERE r."taskId" = $1`,
    [TASK_ID],
  );
  console.log(`\n数据库结果: ${results.rows.length}条`);
  results.rows.forEach((r) =>
    console.log(`  student=${r.studentId?.substring(0, 8)} total=${r.totalScore?.toFixed(2)} color=${r.color} level=${r.level}`),
  );

  const dbAlerts = await db.query(
    `SELECT a.id, a."studentId", a.level, a.color FROM alert_records a WHERE a."taskId" = $1`,
    [TASK_ID],
  );
  console.log(`\n数据库预警: ${dbAlerts.rows.length}条`);

  await db.end();
  console.log('\n=== 完成 ===');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
