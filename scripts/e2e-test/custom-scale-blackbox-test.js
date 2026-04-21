#!/usr/bin/env node

/**
 * 自定义量表黑盒测试
 *
 * 流程：
 *   1. 心理老师登录 → 创建4个自定义量表（焦虑、抑郁、躯体化、强迫），每量表20题
 *   2. 删除旧班级 → 创建7年级2班 + 40名学生
 *   3. 发布评测任务，10名学生用1个量表，覆盖不同风险级别
 *   4. 验证测评结果和随访管理
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

const del = (path, token) => request('DELETE', path, null, token);
const post = (path, body, token) => request('POST', path, body, token);
const get = (path, token) => request('GET', path, null, token);
const put = (path, body, token) => request('PUT', path, body, token);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const STUDENT_PASSWORD = 'Test1234';
const PSYCH_USERNAME = '张毛毛';
const PSYCH_PASSWORD = 'Abc12345';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const DIMENSIONS = [
  { name: '焦虑', prefix: 'JL' },
  { name: '抑郁', prefix: 'YY' },
  { name: '躯体化', prefix: 'QTH' },
  { name: '强迫', prefix: 'QP' },
];

const SCORE_LEVELS = [
  { min: 0, max: 40, level: '正常', color: 'green', suggestion: '心理状况良好' },
  { min: 41, max: 70, level: '轻度', color: 'yellow', suggestion: '建议关注' },
  { min: 71, max: 100, level: '中重度', color: 'red', suggestion: '建议专业咨询' },
];

const DISPLAY_NAMES = [
  '陈一凡', '林雨桐', '张浩然', '王诗涵', '李明轩',
  '赵语嫣', '刘子墨', '杨思远', '黄雅琴', '周天佑',
  '吴梦琪', '郑凯文', '孙婉清', '马俊杰', '朱晓晴',
  '胡宇航', '高欣怡', '何博文', '罗诗琪', '谢泽宇',
  '韩雨萱', '唐睿哲', '冯若曦', '董嘉豪', '彭心怡',
  '曹逸飞', '邓紫涵', '许浩宇', '叶舒雅', '宋昊然',
  '田雨晨', '方子轩', '程雅婷', '沈博文', '任思源',
  '姜梓涵', '钟嘉怡', '徐浩铭', '何雨桐', '唐诗涵',
];

function generateUsername(index) {
  return `stu72_${String(index + 1).padStart(2, '0')}`;
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

function buildScalePayload(dim) {
  const optionTexts = ['从不', '偶尔', '经常', '总是'];
  const optionScores = [0, 1, 3, 5];

  const items = [];
  for (let i = 0; i < 20; i++) {
    items.push({
      itemText: `${dim.name}量表第${i + 1}题`,
      itemType: 'single_choice',
      sortOrder: i,
      dimension: dim.name,
      reverseScore: false,
      options: optionTexts.map((t, oi) => ({
        optionText: t,
        scoreValue: optionScores[oi],
        sortOrder: oi,
      })),
    });
  }

  return {
    name: `${dim.name}自评量表`,
    description: `${dim.name}维度自评量表，共20题`,
    dimensions: [dim.name],
    items,
    scoringRules: [
      { dimension: dim.name, formulaType: 'sum', weight: 1 },
    ],
    scoreRanges: SCORE_LEVELS.map((l) => ({
      dimension: dim.name,
      minScore: l.min,
      maxScore: l.max,
      level: l.level,
      color: l.color,
      suggestion: l.suggestion,
    })),
  };
}

function buildAnswersForScore(items, targetScore) {
  return items.map((item) => {
    let bestOption = item.options[0];
    let bestDiff = Math.abs(item.options[0].scoreValue - targetScore);
    for (const opt of item.options) {
      const diff = Math.abs(opt.scoreValue - targetScore);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestOption = opt;
      }
    }
    return { itemId: item.id, optionId: bestOption.id };
  });
}

const SCORE_PROFILES = [
  { label: 'green', perItem: 0, group: '正常' },
  { label: 'green', perItem: 1, group: '正常' },
  { label: 'yellow', perItem: 3, group: '轻度' },
  { label: 'yellow', perItem: 3, group: '轻度' },
  { label: 'yellow', perItem: 3, group: '轻度' },
  { label: 'yellow', perItem: 5, group: '轻度' },
  { label: 'red', perItem: 5, group: '中重度' },
  { label: 'red', perItem: 5, group: '中重度' },
  { label: 'red', perItem: 5, group: '中重度' },
  { label: 'red', perItem: 5, group: '中重度' },
];

async function main() {
  console.log('=== 自定义量表黑盒测试 ===\n');

  // Step 0: Login
  console.log('Step 0: 登录...');
  const adminToken = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
  console.log('  Admin: OK');
  const psychToken = await login(PSYCH_USERNAME, PSYCH_PASSWORD);
  console.log('  心理老师 (张毛毛): OK');

  // Step 1: Create 4 custom scales
  console.log('\nStep 1: 创建4个自定义量表...');
  const existingScales = await get('/scales', psychToken);
  const scalesArr = Array.isArray(existingScales) ? existingScales : (existingScales.data || []);
  const scales = [];
  for (const dim of DIMENSIONS) {
    const scaleName = `${dim.name}自评量表`;
    let found = scalesArr.find((s) => s.name === scaleName);
    if (found) {
      const full = await get(`/scales/${found.id}`, psychToken);
      scales.push(full);
      console.log(`  ✓ ${dim.name}: [已存在] ${full.items.length}题`);
      continue;
    }
    const payload = buildScalePayload(dim);
    try {
      const scale = await post('/scales', payload, psychToken);
      const full = await get(`/scales/${scale.id}`, psychToken);
      scales.push(full);
      console.log(`  ✓ ${dim.name}: ${full.items.length}题, ${full.scoreRanges?.length || 0}条ranges`);
    } catch (e) {
      console.log(`  ✗ ${dim.name}: ${e.message.substring(0, 120)}`);
    }
  }

  // Step 2: Delete old classes, create new grade + class
  console.log('\nStep 2: 清理旧班级，创建7年级2班...');
  const existingClasses = await get('/admin/classes', adminToken);
  const classList = Array.isArray(existingClasses) ? existingClasses : (existingClasses.data || []);
  for (const c of classList) {
    try {
      await del(`/admin/classes/${c.id}`, adminToken);
      console.log(`  删除班级: ${c.name}`);
    } catch (e) {
      console.log(`  删除班级 ${c.name} 失败: ${e.message.substring(0, 80)}`);
    }
  }

  const db = await getDbClient();
  const oldUsers = (await db.query("SELECT id FROM users WHERE username LIKE 'stu72_%' OR username LIKE 'stu7_%'")).rows.map(r => r.id);
  if (oldUsers.length > 0) {
    const oldAnswers = (await db.query('SELECT id FROM task_answers WHERE "studentId" = ANY($1)', [oldUsers])).rows.map(r => r.id);
    if (oldAnswers.length > 0) {
      await db.query('DELETE FROM alert_records WHERE "studentId" = ANY($1)', [oldUsers]).catch(() => {});
      await db.query('DELETE FROM task_results WHERE "answerId" = ANY($1)', [oldAnswers]);
      await db.query('DELETE FROM task_answer_items WHERE "answerId" = ANY($1)', [oldAnswers]);
      await db.query('DELETE FROM task_answers WHERE id = ANY($1)', [oldAnswers]);
    }
    await db.query('DELETE FROM consent_records WHERE "userId" = ANY($1)', [oldUsers]);
    await db.query('DELETE FROM user_roles WHERE "userId" = ANY($1)', [oldUsers]);
    await db.query('DELETE FROM users WHERE id = ANY($1)', [oldUsers]);
  }
  console.log(`  清理旧用户: ${oldUsers.length}名`);

  let grade;
  const gradesList = await get('/admin/grades', adminToken);
  const gradesArr = Array.isArray(gradesList) ? gradesList : (gradesList.data || []);
  grade = gradesArr.find((g) => g.name === '7年级');
  if (grade) {
    console.log(`  年级已存在: ${grade.name} (${grade.id})`);
  } else {
    try {
      grade = await post('/admin/grades', { name: '7年级', sortOrder: 7 }, adminToken);
      console.log(`  年级: ${grade.name} (${grade.id})`);
    } catch (e) {
      throw new Error(`创建年级失败: ${e.message.substring(0, 120)}`);
    }
  }

  let cls;
  const classesList = await get('/admin/classes', adminToken);
  const classesArr = Array.isArray(classesList) ? classesList : (classesList.data || []);
  cls = classesArr.find((c) => c.name === '7年2班');
  if (cls) {
    console.log(`  班级已存在: ${cls.name} (${cls.id})`);
  } else {
    try {
      cls = await post('/admin/classes', { name: '7年2班', gradeId: grade.id, sortOrder: 2 }, adminToken);
      console.log(`  班级: ${cls.name} (${cls.id})`);
    } catch (e) {
      throw new Error(`创建班级失败: ${e.message.substring(0, 120)}`);
    }
  }

  // Step 3: Create 40 students
  console.log('\nStep 3: 创建40名学生记录...');
  const existingStudents = await db.query(
    `SELECT id FROM students WHERE "classId" = $1 ORDER BY "createdAt"`,
    [cls.id],
  );
  const students = existingStudents.rows.map((r) => ({ id: r.id }));

  for (let i = students.length; i < 40; i++) {
    const result = await db.query(
      `INSERT INTO students (id, "classId", "encryptedName", "encryptedStudentNumber", gender)
       VALUES (uuid_generate_v4(), $1, pgp_sym_encrypt($2, current_setting('app.encryption_key')), pgp_sym_encrypt($3, current_setting('app.encryption_key')), $4)
       RETURNING id`,
      [cls.id, DISPLAY_NAMES[i], `702${String(i + 1).padStart(2, '0')}`, i % 2 === 0 ? 'M' : 'F'],
    );
    students.push({ id: result.rows[0].id });
  }
  console.log(`  共 ${students.length} 名学生`);

  // Step 4: Create 40 user accounts
  console.log('\nStep 4: 创建40个学生用户账号...');
  const rolesResp = await get('/admin/roles', adminToken);
  const rolesList = rolesResp.data || rolesResp;
  const studentRole = Array.isArray(rolesList) ? rolesList.find((r) => r.name === 'student') : null;
  if (!studentRole) throw new Error('student role not found');

  const allUsersResp = await get('/admin/users', adminToken);
  const allUsers = allUsersResp.data || allUsersResp;
  const users = [];

  for (let i = 0; i < 40; i++) {
    const username = generateUsername(i);
    const existing = Array.isArray(allUsers) ? allUsers.find((u) => u.username === username) : null;
    if (existing) {
      users.push(existing);
      if (i < 5 || i >= 35) console.log(`  用户 ${i + 1}: ${username} [已存在]`);
      continue;
    }
    try {
      const user = await post('/admin/users', {
        username,
        password: STUDENT_PASSWORD,
        displayName: DISPLAY_NAMES[i],
        roleIds: [studentRole.id],
      }, adminToken);
      await put(`/admin/users/${user.id}`, {
        studentRecordId: students[i].id,
      }, adminToken);
      user.studentId = students[i].id;
      users.push(user);
      if (i < 5 || i >= 35) console.log(`  用户 ${i + 1}: ${username} → ${DISPLAY_NAMES[i]}`);
    } catch (e) {
      console.log(`  用户 ${i + 1}: ${username} ✗ ${e.message.substring(0, 100)}`);
      users.push(null);
    }
  }
  console.log(`  已创建/找到 ${users.filter(Boolean).length}/40 个用户`);

  // Step 5: Create 4 tasks (one per scale)
  console.log('\nStep 5: 创建4个评测任务...');
  const tasks = [];
  for (let di = 0; di < scales.length; di++) {
    const scale = scales[di];
    const title = `7年2班${scale.name}测评`;
    let task;
    try {
      task = await post('/tasks', {
        scaleId: scale.id,
        title,
        targetIds: [cls.id],
        targetType: 'class',
      }, psychToken);
      console.log(`  任务 ${di + 1}: ${title} (${task.id?.substring(0, 8)}...)`);
    } catch (e) {
      const allTasks = await get('/tasks', psychToken);
      task = Array.isArray(allTasks) ? allTasks.find((t) => t.title === title) : null;
      if (task) console.log(`  任务 ${di + 1}: ${title} [已存在]`);
      else { console.log(`  任务 ${di + 1}: ✗ ${e.message.substring(0, 100)}`); continue; }
    }

    if (task.status === 'draft') {
      await post(`/tasks/${task.id}/publish`, {}, psychToken);
      task = await get(`/tasks/${task.id}`, psychToken);
    }
    tasks.push({ task, scale, dimIndex: di });
  }

  // Step 6: Sign consent
  console.log('\nStep 6: 签署知情同意...');
  let consentOk = 0;
  for (let i = 0; i < 40; i++) {
    const user = users[i];
    if (!user) continue;
    try {
      await post('/consent', {
        userId: user.id,
        studentId: students[i].id,
        consentType: 'assessment',
        contentHash: 'custom-scale-test-v1',
        signedAt: new Date().toISOString(),
      }, adminToken);
      consentOk++;
    } catch (e) {
      if (e.body && e.body.includes('already')) consentOk++;
    }
  }
  console.log(`  已签署: ${consentOk}/40`);

  // Step 7: Submit answers (10 students per task)
  console.log('\nStep 7: 40名学生答题 (10人/量表)...');
  const colorCounts = { green: 0, yellow: 0, red: 0, other: 0 };
  const alertList = [];

  for (let ti = 0; ti < tasks.length; ti++) {
    const { task, scale, dimIndex } = tasks[ti];
    if (!task) continue;

    const fullScale = await get(`/scales/${scale.id}`, psychToken);
    const items = fullScale.items;
    const dimName = DIMENSIONS[dimIndex].name;

    console.log(`\n  --- ${dimName}量表 (${items.length}题) ---`);

    for (let si = 0; si < 10; si++) {
      const studentIndex = dimIndex * 10 + si;
      const user = users[studentIndex];
      if (!user) {
        console.log(`    学生 ${studentIndex + 1}: 跳过(无账号)`);
        continue;
      }

      if (studentIndex > 0 && studentIndex % 10 === 0) {
        await sleep(2000);
      }

      const username = generateUsername(studentIndex);
      let studentToken;
      try {
        studentToken = await login(username, STUDENT_PASSWORD);
      } catch (e) {
        console.log(`    学生 ${studentIndex + 1}: 登录失败 ${e.message.substring(0, 60)}`);
        continue;
      }

      const profile = SCORE_PROFILES[si];
      const answers = buildAnswersForScore(items, profile.perItem);

      try {
        const result = await post(`/tasks/${task.id}/answers/submit`, { items: answers }, studentToken);
        const color = result.color || 'unknown';
        if (colorCounts[color] !== undefined) colorCounts[color]++;
        else colorCounts.other++;
        console.log(
          `    学生 ${studentIndex + 1}: ${DISPLAY_NAMES[studentIndex]} → ` +
          `score=${result.totalScore}, ${color}/${result.level} [${profile.group}]`,
        );
        if (color === 'red' || color === 'yellow') {
          alertList.push({
            name: DISPLAY_NAMES[studentIndex],
            dim: dimName,
            color,
            level: result.level,
          });
        }
      } catch (e) {
        console.log(`    学生 ${studentIndex + 1}: ${DISPLAY_NAMES[studentIndex]} ✗ ${e.message.substring(0, 100)}`);
      }
      await sleep(300);
    }
  }

  // Step 8: Verify results
  console.log('\n=== Step 8: 验证结果 ===');

  console.log('\n评分分布:');
  console.log(`  Green (正常): ${colorCounts.green}`);
  console.log(`  Yellow (轻度): ${colorCounts.yellow}`);
  console.log(`  Red (中重度): ${colorCounts.red}`);
  console.log(`  Other: ${colorCounts.other}`);

  console.log(`\n预警学生 (${alertList.length}名):`);
  for (const a of alertList) {
    const icon = a.color === 'red' ? '🔴' : '🟡';
    console.log(`  ${icon} ${a.name} — ${a.dim}/${a.level}`);
  }

  // Check followup management
  console.log('\n--- 随访管理 ---');
  try {
    const followupResult = await get('/followup-manage/students', psychToken);
    const followupData = followupResult.data || followupResult;
    if (Array.isArray(followupData)) {
      console.log(`  随访列表: ${followupData.length}名学生`);
      for (const s of followupData) {
        console.log(`  - ${s.studentName} (${s.className}) 风险: ${s.riskColor}/${s.riskLevel}`);
      }
    } else {
      const total = followupData.total ?? (Array.isArray(followupResult) ? followupResult.length : '?');
      const data = followupData.data || followupResult;
      console.log(`  随访列表: ${total}名学生`);
      if (Array.isArray(data)) {
        for (const s of data.slice(0, 10)) {
          console.log(`  - ${s.studentName} (${s.className}) 风险: ${s.riskColor}/${s.riskLevel}`);
        }
        if (data.length > 10) console.log(`  ... 共${data.length}条`);
      }
    }
  } catch (e) {
    console.log(`  随访查询失败: ${e.message.substring(0, 100)}`);
  }

  // Check results list
  console.log('\n--- 测评结果 ---');
  try {
    const results = await get('/results', psychToken);
    const data = Array.isArray(results) ? results : (results.data || []);
    console.log(`  结果列表: ${Array.isArray(data) ? data.length : '?'}条`);
    if (Array.isArray(data) && data.length > 0) {
      for (const r of data.slice(0, 5)) {
        console.log(`  - ${r.studentName || '?'} (${r.className || '?'}) ${r.scaleName || '?'} → ${r.result?.level || r.level || '?'} ${r.result?.color || r.color || '?'}`);
      }
      if (data.length > 5) console.log(`  ... 共${data.length}条`);
    }
  } catch (e) {
    console.log(`  结果查询失败: ${e.message.substring(0, 100)}`);
  }

  // Check dashboard
  try {
    const overview = await get('/dashboard/overview', psychToken);
    console.log(`\n--- Dashboard ---`);
    console.log(`  任务=${overview.total_tasks}, 提交=${overview.submitted_answers}, 预警=${overview.total_alerts}(红${overview.red_alerts}/黄${overview.yellow_alerts})`);
  } catch (e) { /* ignore */ }

  await db.end();

  console.log('\n=== 测试账号列表 ===');
  for (let i = 0; i < 40; i++) {
    const dimIdx = Math.floor(i / 10);
    const si = i % 10;
    const profile = SCORE_PROFILES[si];
    const dim = DIMENSIONS[dimIdx]?.name || '?';
    console.log(`  [${dim}/${profile.group}] ${generateUsername(i)} / ${STUDENT_PASSWORD} — ${DISPLAY_NAMES[i]}`);
  }

  console.log('\n=== 完成 ===');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
