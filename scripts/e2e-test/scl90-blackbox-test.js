#!/usr/bin/env node

/**
 * SCL-90 黑盒测试端到端脚本 v2
 *
 * 适配实际API：
 *   - 学生姓名加密存储，创建时只需 classId + gender
 *   - 班级需要 gradeId + name + sortOrder
 *   - 年级需要 name + sortOrder
 *   - 用户创建通过 /api/admin/users
 *   - 知情同意通过 /api/consent
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
            `HTTP ${res.statusCode} ${method} ${path}: ${data.substring(0, 200)}`,
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
const put = (path, body, token) => request('PUT', path, body, token);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const DISPLAY_NAMES = [
  '陈一凡', '林雨桐', '张浩然', '王诗涵', '李明轩',
  '赵语嫣', '刘子墨', '杨思远', '黄雅琴', '周天佑',
  '吴梦琪', '郑凯文', '孙婉清', '马俊杰', '朱晓晴',
  '胡宇航', '高欣怡', '何博文', '罗诗琪', '谢泽宇',
  '韩雨萱', '唐睿哲', '冯若曦', '董嘉豪', '彭心怡',
  '曹逸飞', '邓紫涵', '许浩宇', '叶舒雅', '宋昊然',
];

const PASSWORD = 'Test1234';

function generateUsername(index) {
  return `stu7_${String(index + 1).padStart(2, '0')}`;
}

async function login(username, password) {
  const res = await post('/auth/login', { username, password });
  return res.accessToken;
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

async function main() {
  console.log('=== SCL-90 黑盒测试端到端流程 v2 ===\n');

  // Step 0: Login
  console.log('Step 0: 登录各角色...');
  const adminToken = await login('admin', 'admin123');
  console.log('  Admin: OK');
  const psychToken = await login('zhangmm', 'Mm123456');
  console.log('  Psychologist: OK');

  // Step 1: Create grade + class
  console.log('\nStep 1: 创建年级和班级...');
  let grade;
  try {
    grade = await post('/admin/grades', { name: '7年级', sortOrder: 7 }, adminToken);
    console.log(`  年级: ${grade.name} (${grade.id})`);
  } catch (e) {
    const grades = await get('/admin/grades', adminToken);
    grade = Array.isArray(grades) ? grades.find((g) => g.name === '7年级') : null;
    if (grade) console.log(`  年级已存在: ${grade.name} (${grade.id})`);
    else throw e;
  }

  let cls;
  try {
    cls = await post('/admin/classes', { name: '7年1班', gradeId: grade.id, sortOrder: 1 }, adminToken);
    console.log(`  班级: ${cls.name} (${cls.id})`);
  } catch (e) {
    const classes = await get('/admin/classes', adminToken);
    cls = Array.isArray(classes)
      ? classes.find((c) => c.name === '7年1班' && c.gradeId === grade.id)
      : null;
    if (cls) console.log(`  班级已存在: ${cls.name} (${cls.id})`);
    else throw e;
  }

  // Step 2: Create 30 student records
  console.log('\nStep 2: 创建30名学生记录...');
  const db = await getDbClient();
  const existingStudents = await db.query(
    `SELECT id FROM students WHERE "classId" = $1 ORDER BY "createdAt"`,
    [cls.id],
  );
  const students = existingStudents.rows.map((r) => ({ id: r.id }));
  console.log(`  已有学生: ${students.length}名`);

  for (let i = students.length; i < 30; i++) {
    const result = await db.query(
      `INSERT INTO students (id, "classId", "encryptedName", "encryptedStudentNumber", gender)
       VALUES (uuid_generate_v4(), $1, pgp_sym_encrypt($2, current_setting('app.encryption_key')), pgp_sym_encrypt($3, current_setting('app.encryption_key')), $4)
       RETURNING id`,
      [cls.id, DISPLAY_NAMES[i], `701${String(i + 1).padStart(2, '0')}`, i % 2 === 0 ? 'M' : 'F'],
    );
    students.push({ id: result.rows[0].id });
    console.log(`  学生 ${i + 1}: ${DISPLAY_NAMES[i]} (${result.rows[0].id.substring(0, 8)})`);
  }
  console.log(`  共 ${students.length} 名学生`);

  // Step 3: Create 30 user accounts
  console.log('\nStep 3: 创建30个学生用户账号...');
  const rolesResp = await get('/admin/roles', adminToken);
  const rolesList = rolesResp.data || rolesResp;
  const studentRole = Array.isArray(rolesList) ? rolesList.find((r) => r.name === 'student') : null;
  if (!studentRole) throw new Error('student role not found');
  console.log(`  student role: ${studentRole.id}`);

  const allExistingUsersResp = await get('/admin/users', adminToken);
  const allExistingUsers = allExistingUsersResp.data || allExistingUsersResp;
  const users = [];
  for (let i = 0; i < 30; i++) {
    const username = generateUsername(i);
    const existing = Array.isArray(allExistingUsers) ? allExistingUsers.find((u) => u.username === username) : null;
    if (existing) {
      users.push(existing);
      console.log(`  用户 ${i + 1}: ${username} [已存在]`);
      continue;
    }
    try {
      const user = await post('/admin/users', {
        username,
        password: PASSWORD,
        displayName: DISPLAY_NAMES[i],
        roleIds: [studentRole.id],
      }, adminToken);
      // Set studentId via update
      await put(`/admin/users/${user.id}`, {
        studentRecordId: students[i].id,
      }, adminToken);
      user.studentId = students[i].id;
      users.push(user);
      console.log(`  用户 ${i + 1}: ${username} / ${PASSWORD} → ${DISPLAY_NAMES[i]}`);
    } catch (e) {
      console.log(`  用户 ${i + 1}: ${username} ✗ ${e.message.substring(0, 100)}`);
      users.push(null);
    }
  }

  // Step 4: Add total score ranges for SCL-90
  console.log('\nStep 4: 为 SCL-90 添加总分 score ranges...');
  const scl90LibraryId = '59d8afcb-ad73-4059-9e6e-d827a39a3cd7';
  const existingTotalRanges = await db.query(
    `SELECT count(*) FROM score_ranges WHERE "scaleId" = $1 AND dimension IS NULL`,
    [scl90LibraryId],
  );
  if (parseInt(existingTotalRanges.rows[0].count) === 0) {
    await db.query(`
      INSERT INTO score_ranges ("id", "scaleId", "dimension", "minScore", "maxScore", "level", "color", "suggestion") VALUES
      (uuid_generate_v4(), $1, NULL, 1.0, 2.0, '正常', 'green', '心理状况良好，无需特别干预'),
      (uuid_generate_v4(), $1, NULL, 2.01, 3.0, '轻度', 'yellow', '建议关注，可进行心理辅导'),
      (uuid_generate_v4(), $1, NULL, 3.01, 5.0, '中重度', 'red', '建议尽快安排专业心理咨询')
    `, [scl90LibraryId]);
    console.log('  ✓ 添加3条总分 score ranges');
  } else {
    console.log('  ✓ 总分 score ranges 已存在');
  }

  // Step 5: Clone SCL-90 and create task
  console.log('\nStep 5: 心理老师克隆量表并创建任务...');
  let clonedScale;
  try {
    clonedScale = await post(`/scales/library/${scl90LibraryId}/clone`, {}, psychToken);
    console.log(`  克隆量表: ${clonedScale.name} (${clonedScale.id})`);
  } catch (e) {
    const scales = await get('/scales', psychToken);
    clonedScale = Array.isArray(scales)
      ? scales.find((s) => s.parentScaleId === scl90LibraryId && !s.isLibrary)
      : null;
    if (clonedScale) console.log(`  克隆量表已存在: ${clonedScale.name}`);
    else throw e;
  }
  if (!clonedScale) throw new Error('无法获取克隆量表');

  const clonedFull = await get(`/scales/${clonedScale.id}`, psychToken);
  const items = clonedFull.items;
  console.log(`  量表: ${items.length}题, ${clonedFull.scoreRanges.length}条ranges`);

  let task;
  try {
    task = await post('/tasks', {
      scaleId: clonedScale.id,
      title: '7年1班SCL-90心理健康测评',
      targetIds: [cls.id],
      targetType: 'class',
    }, psychToken);
    console.log(`  任务创建: ${task.title}, status=${task.status}`);
  } catch (e) {
    const tasks = await get('/tasks', psychToken);
    task = Array.isArray(tasks) ? tasks.find((t) => t.title === '7年1班SCL-90心理健康测评') : null;
    if (task) console.log(`  任务已存在: ${task.title}, status=${task.status}`);
    else throw e;
  }

  if (task.status === 'draft') {
    await post(`/tasks/${task.id}/publish`, {}, psychToken);
    task = await get(`/tasks/${task.id}`, psychToken);
    console.log(`  任务已发布, status=${task.status}`);
  }

  // Step 6: Sign consent
  console.log('\nStep 6: 签署知情同意...');
  for (let i = 0; i < 30; i++) {
    const user = users[i];
    if (!user) continue;
    const student = students[i];
    try {
      await post('/consent', {
        userId: user.id,
        studentId: student.id,
        consentType: 'assessment',
        contentHash: 'e2e-test-consent-v2',
        signedAt: new Date().toISOString(),
      }, adminToken);
      console.log(`  同意 ${i + 1}: ${DISPLAY_NAMES[i]} ✓`);
    } catch (e) {
      if (e.body && e.body.includes('already')) {
        console.log(`  同意 ${i + 1}: ${DISPLAY_NAMES[i]} [已签]`);
      } else {
        console.log(`  同意 ${i + 1}: ${DISPLAY_NAMES[i]} ✗ ${e.message.substring(0, 80)}`);
      }
    }
  }

  // Step 7: Submit answers
  console.log('\nStep 7: 30个学生按规则答题...');
  console.log('  Group A (1-10): 全选"没有" (scoreValue=1) → 预期 green');
  console.log('  Group B (11-20): 奇数选"很轻"(2), 偶数选"中等"(3) → 预期 yellow');
  console.log('  Group C (21-30): 全选"偏重" (scoreValue=4) → 预期 red');

  function buildAnswers(studentIndex, items) {
    return items.map((item) => {
      let targetScore;
      if (studentIndex < 10) {
        targetScore = 1;
      } else if (studentIndex < 20) {
        targetScore = studentIndex % 2 === 0 ? 2 : 3;
      } else {
        targetScore = 4;
      }
      const option = item.options.find((o) => o.scoreValue === targetScore);
      return { itemId: item.id, optionId: option ? option.id : item.options[0].id };
    });
  }

  const colorCounts = { green: 0, yellow: 0, red: 0, gray: 0, other: 0 };
  const alertList = [];

  for (let i = 0; i < 30; i++) {
    if (!users[i]) {
      console.log(`  学生 ${i + 1}: ${DISPLAY_NAMES[i]} — 跳过(用户未创建)`);
      continue;
    }

    if (i > 0) {
      console.log(`  [等待13秒避免登录限流...]`);
      await sleep(13000);
    }

    const username = generateUsername(i);
    let studentToken;
    try {
      studentToken = await login(username, PASSWORD);
    } catch (e) {
      console.log(`  学生 ${i + 1}: ${DISPLAY_NAMES[i]} — 登录失败: ${e.message.substring(0, 100)}`);
      continue;
    }

    const answers = buildAnswers(i, items);
    const group = i < 10 ? 'A' : i < 20 ? 'B' : 'C';

    try {
      const result = await post(`/tasks/${task.id}/answers/submit`, { items: answers }, studentToken);
      const color = result.color || 'unknown';
      colorCounts[color] = (colorCounts[color] || 0) + 1;
      console.log(`  学生 ${i + 1} [${group}]: ${DISPLAY_NAMES[i]} → total=${result.totalScore}, color=${color}, level=${result.level}`);
      if (color === 'red' || color === 'yellow') {
        alertList.push({ name: DISPLAY_NAMES[i], color, level: result.level });
      }
    } catch (e) {
      console.log(`  学生 ${i + 1} [${group}]: ${DISPLAY_NAMES[i]} ✗ ${e.message.substring(0, 120)}`);
    }
    await sleep(300);
  }

  // Step 8: Verify
  console.log('\n=== Step 8: 验证结果 ===');
  console.log(`\n评分分布:`);
  console.log(`  Green (正常): ${colorCounts.green}`);
  console.log(`  Yellow (轻度): ${colorCounts.yellow}`);
  console.log(`  Red (中重度): ${colorCounts.red}`);
  console.log(`  Gray/Other: ${(colorCounts.gray || 0) + (colorCounts.other || 0)}`);

  console.log(`\n预警触发 (${alertList.length}条):`);
  alertList.forEach((a) => console.log(`  ${a.color === 'red' ? '🔴' : '🟡'} ${a.name} — ${a.level}`));

  // Check alerts API
  try {
    const alerts = await get('/alerts', psychToken);
    if (Array.isArray(alerts)) {
      console.log(`\n预警记录: ${alerts.length}条 (红:${alerts.filter(a => a.level === 'red').length}, 黄:${alerts.filter(a => a.level === 'yellow').length})`);
    }
  } catch (e) { /* ignore */ }

  // Check dashboard
  try {
    const overview = await get('/dashboard/overview', psychToken);
    console.log(`\nDashboard: 任务=${overview.total_tasks}, 提交=${overview.submitted_answers}, 预警=${overview.total_alerts}(红${overview.red_alerts}/黄${overview.yellow_alerts})`);
  } catch (e) { /* ignore */ }

  await db.end();

  // Print account list
  console.log('\n=== 测试账号列表 ===');
  for (let i = 0; i < 30; i++) {
    const group = i < 10 ? 'A正常' : i < 20 ? 'B轻度' : 'C中重度';
    const rule = i < 10 ? '全选"没有"' : i < 20 ? (i % 2 === 0 ? '全选"很轻"' : '全选"中等"') : '全选"偏重"';
    console.log(`  [${group}] ${generateUsername(i)} / ${PASSWORD} — ${DISPLAY_NAMES[i]} (${rule})`);
  }

  console.log('\n=== 完成 ===');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
