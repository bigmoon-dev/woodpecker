const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const readline = require('readline');
const crypto = require('crypto');
const ota = require('./ota-client');
const backup = require('./backup');

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

    try {
      await backup.createBackup(currentVersion);
      backup.cleanupOldBackups();
    } catch (e) {
      console.log(`  ⚠️  OTA前数据库备份失败: ${e.message}`);
    }

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
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ok = await doSeed(attempt);
      if (ok) return;
      if (attempt < MAX_RETRIES) {
        console.log(`  ⚠️ 种子数据验证失败，第 ${attempt} 次重试...`);
        await sleep(2000);
      }
    } catch (e) {
      const msg = `[${new Date().toISOString()}] seed attempt ${attempt} failed: ${e.message}\n`;
      const logFile = path.join(DATA_DIR, 'seed-error.log');
      fs.appendFileSync(logFile, msg);
      console.log(`  ⚠️ 种子数据失败 (第${attempt}次): ${e.message}`);
      if (attempt < MAX_RETRIES) await sleep(2000);
    }
  }
}

async function doSeed(attempt) {
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

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    const check = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`);
    if (check.rows.length === 0) return true;

    if (attempt === 1) console.log('  检查初始数据...');

    const roles = [
      { name: 'admin', desc: '系统管理员', displayName: '系统管理员' },
      { name: 'psychologist', desc: '心理老师', displayName: '心理老师' },
      { name: 'teacher', desc: '班主任', displayName: '班主任' },
      { name: 'student', desc: '学生', displayName: '学生' },
    ];
    const roleIds = {};
    for (const role of roles) {
      let res = await client.query(`SELECT "id", "displayName" FROM "roles" WHERE "name" = $1`, [role.name]);
      if (res.rows.length > 0) {
        roleIds[role.name] = res.rows[0].id;
        if (!res.rows[0].displayName) {
          await client.query(`UPDATE "roles" SET "displayName" = $1 WHERE "name" = $2`, [role.displayName, role.name]);
        }
      } else {
        res = await client.query(
          `INSERT INTO "roles" ("id", "name", "description", "isSystem", "displayName") VALUES (gen_random_uuid(), $1, $2, true, $3) RETURNING "id"`,
          [role.name, role.desc, role.displayName]
        );
        roleIds[role.name] = res.rows[0].id;
      }
    }

    const permissions = [
      { code: 'scale:read', name: '查看量表', category: 'scale' },
      { code: 'scale:write', name: '管理量表', category: 'scale' },
      { code: 'scale:delete', name: '删除量表', category: 'scale' },
      { code: 'task:read', name: '查看任务', category: 'task' },
      { code: 'task:write', name: '管理任务', category: 'task' },
      { code: 'task:submit', name: '提交任务', category: 'task' },
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

    const studentPerms = await client.query(
      `SELECT "id" FROM "permissions" WHERE "code" IN ('task:read', 'task:submit', 'result:read', 'consent:read', 'consent:write')`
    );
    for (const permRow of studentPerms.rows) {
      await client.query(
        `INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
        [roleIds['student'], permRow.id]
      );
    }

    const teacherPerms = await client.query(
      `SELECT "id" FROM "permissions" WHERE "code" IN ('task:read', 'result:read', 'alert:read', 'consent:read', 'student:read', 'followup:read')`
    );
    for (const permRow of teacherPerms.rows) {
      await client.query(
        `INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES ($1, $2) ON CONFLICT ("roleId", "permissionId") DO NOTHING`,
        [roleIds['teacher'], permRow.id]
      );
    }

    const users = [
      { username: 'admin', password: '$2b$10$6fpCy6AzEnC0frnktI0HS./nAmn1OAPWxn/q7593h8w92LI83T8OS', displayName: '系统管理员' },
      { username: '张毛毛', password: '$2b$10$6AENzM1tdUjK1JwFcUpvbOloyn9tPKpFscWoh/L22mIGqYkcWtzDy', displayName: '张毛毛' },
    ];
    const userIds = {};
    for (const u of users) {
      const existing = await client.query(`SELECT "id" FROM "users" WHERE "username" = $1`, [u.username]);
      if (existing.rows.length > 0) {
        userIds[u.username] = existing.rows[0].id;
      } else {
        const res = await client.query(
          `INSERT INTO "users" ("id", "username", "password", "displayName", "status") VALUES (gen_random_uuid(), $1, $2, $3, 'active') RETURNING "id"`,
          [u.username, u.password, u.displayName]
        );
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

    // Seed library scales (SCL-90, SDS, SAS, MHT)
    const existingLibScales = (await client.query(`SELECT COUNT(*) as c FROM "scales" WHERE "isLibrary" = true`)).rows[0].c;
    if (parseInt(existingLibScales) === 0) {
      console.log('  📚 初始化量表库...');
      const libraryScales = [
        {
          name: '症状自评量表 (SCL-90)', version: '1.0', description: 'Derogatis编制的症状自评量表，包含90个项目，涵盖躯体化、强迫、人际敏感、抑郁、焦虑、敌对、恐怖、偏执、精神病性9个因子',
          source: 'library:SCL-90.xlsx',
          dimensions: ['躯体化','强迫','人际敏感','抑郁','焦虑','敌对','恐怖','偏执','精神病性','其他'],
          items: [
            { text: '头痛', dim: '躯体化', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '神经过敏，心中不踏实', dim: '躯体化', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '头脑中有不必要的想法或字句盘旋', dim: '强迫', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '容易哭泣', dim: '抑郁', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '感到害怕', dim: '恐怖', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '感到孤独', dim: '抑郁', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '感到别人能控制你的思想', dim: '偏执', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '当别人看着你或谈论你时感到不自在', dim: '人际敏感', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '容易紧张和焦虑', dim: '焦虑', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
            { text: '无缘无故地突然感到害怕', dim: '焦虑', opts: ['没有:1','很轻:2','中等:3','偏重:4','严重:5'] },
          ],
          rules: [
            { dim: '躯体化', formula: 'sum', weight: 1 },
            { dim: '强迫', formula: 'sum', weight: 1 },
            { dim: '抑郁', formula: 'sum', weight: 1 },
            { dim: '焦虑', formula: 'sum', weight: 1 },
          ],
          ranges: [
            { dim: null, min: 0, max: 160, level: '正常', color: 'green', suggestion: '心理健康状况良好' },
            { dim: null, min: 161, max: 225, level: '轻度异常', color: 'yellow', suggestion: '建议关注心理健康' },
            { dim: null, min: 226, max: 500, level: '明显异常', color: 'red', suggestion: '建议寻求专业帮助' },
          ]
        },
        {
          name: '抑郁自评量表 (SDS)', version: '1.0', description: 'Zung抑郁自评量表，包含20个项目，评估抑郁状态的严重程度',
          source: 'library:SDS.xlsx',
          dimensions: ['抑郁'],
          items: [
            { text: '我觉得闷闷不乐，情绪低沉', dim: '抑郁', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我觉得一天中早晨最好', dim: '抑郁', opts: ['从无或偶尔:4','有时:3','经常:2','总是如此:1'] },
            { text: '我一阵阵地哭出来或想哭', dim: '抑郁', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我晚上睡眠不好', dim: '抑郁', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我吃的跟平常一样多', dim: '抑郁', opts: ['从无或偶尔:4','有时:3','经常:2','总是如此:1'] },
            { text: '我觉得做出决定是容易的', dim: '抑郁', opts: ['从无或偶尔:4','有时:3','经常:2','总是如此:1'] },
          ],
          rules: [{ dim: '抑郁', formula: 'sum', weight: 1.25 }],
          ranges: [
            { dim: null, min: 0, max: 49, level: '正常', color: 'green', suggestion: '无抑郁症状' },
            { dim: null, min: 50, max: 59, level: '轻度抑郁', color: 'yellow', suggestion: '建议关注情绪变化' },
            { dim: null, min: 60, max: 69, level: '中度抑郁', color: 'orange', suggestion: '建议寻求专业帮助' },
            { dim: null, min: 70, max: 100, level: '重度抑郁', color: 'red', suggestion: '建议尽快寻求专业帮助' },
          ]
        },
        {
          name: '焦虑自评量表 (SAS)', version: '1.0', description: 'Zung焦虑自评量表，包含20个项目，评估焦虑状态的严重程度',
          source: 'library:SAS.xlsx',
          dimensions: ['焦虑'],
          items: [
            { text: '我觉得比平常容易紧张和着急', dim: '焦虑', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我无缘无故地感到害怕', dim: '焦虑', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我容易心里烦乱或觉得惊恐', dim: '焦虑', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我觉得我可能将要发疯', dim: '焦虑', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
            { text: '我手脚发抖打颤', dim: '焦虑', opts: ['从无或偶尔:1','有时:2','经常:3','总是如此:4'] },
          ],
          rules: [{ dim: '焦虑', formula: 'sum', weight: 1.25 }],
          ranges: [
            { dim: null, min: 0, max: 49, level: '正常', color: 'green', suggestion: '无焦虑症状' },
            { dim: null, min: 50, max: 59, level: '轻度焦虑', color: 'yellow', suggestion: '建议关注情绪变化' },
            { dim: null, min: 60, max: 69, level: '中度焦虑', color: 'orange', suggestion: '建议寻求专业帮助' },
            { dim: null, min: 70, max: 100, level: '重度焦虑', color: 'red', suggestion: '建议尽快寻求专业帮助' },
          ]
        },
        {
          name: '心理健康测试 (MHT)', version: '1.0', description: '心理健康测试量表，适用于中小学生心理健康状况评估',
          source: 'library:MHT.xlsx',
          dimensions: ['学习焦虑','对人焦虑','孤独倾向','自责倾向','过敏倾向','身体症状','恐怖倾向','冲动倾向'],
          items: [
            { text: '你夜里睡觉时，是否总想着明天的功课', dim: '学习焦虑', opts: ['是:1','否:0'] },
            { text: '老师向全班提问时，你是否会觉得是在问自己而感到不安', dim: '对人焦虑', opts: ['是:1','否:0'] },
            { text: '你是否希望总一个人呆着', dim: '孤独倾向', opts: ['是:1','否:0'] },
            { text: '你是否经常觉得有同学在背后说你坏话', dim: '对人焦虑', opts: ['是:1','否:0'] },
            { text: '你受到父母批评后，是否总是想不开', dim: '自责倾向', opts: ['是:1','否:0'] },
            { text: '你夜里睡觉时，是否经常做噩梦', dim: '身体症状', opts: ['是:1','否:0'] },
          ],
          rules: [
            { dim: '学习焦虑', formula: 'sum', weight: 1 },
            { dim: '对人焦虑', formula: 'sum', weight: 1 },
          ],
          ranges: [
            { dim: null, min: 0, max: 35, level: '正常', color: 'green', suggestion: '心理健康状况良好' },
            { dim: null, min: 36, max: 55, level: '需关注', color: 'yellow', suggestion: '建议关注心理健康' },
            { dim: null, min: 56, max: 100, level: '异常', color: 'red', suggestion: '建议寻求专业帮助' },
          ]
        },
      ];

      for (const scale of libraryScales) {
        const scaleRes = await client.query(
          `INSERT INTO "scales" ("id", "name", "version", "description", "source", "status", "isLibrary", "dimensions", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', true, $5, NOW()) RETURNING "id"`,
          [scale.name, scale.version, scale.description, scale.source, JSON.stringify(scale.dimensions)]
        );
        const scaleId = scaleRes.rows[0].id;

        let sortOrder = 0;
        for (const item of scale.items) {
          const itemRes = await client.query(
            `INSERT INTO "scale_items" ("id", "scaleId", "itemText", "itemType", "sortOrder", "dimension")
             VALUES (gen_random_uuid(), $1, $2, 'single_choice', $3, $4) RETURNING "id"`,
            [scaleId, item.text, sortOrder++, item.dim]
          );
          const itemId = itemRes.rows[0].id;
          let optOrder = 0;
          for (const optStr of item.opts) {
            const [text, score] = optStr.split(':');
            await client.query(
              `INSERT INTO "scale_options" ("id", "itemId", "optionText", "scoreValue", "sortOrder")
               VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
              [itemId, text, parseInt(score), optOrder++]
            );
          }
        }

        for (const rule of scale.rules) {
          await client.query(
            `INSERT INTO "scoring_rules" ("id", "scaleId", "dimension", "formulaType", "weight")
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [scaleId, rule.dim, rule.formula, rule.weight]
          );
        }
        for (const range of scale.ranges) {
          await client.query(
            `INSERT INTO "score_ranges" ("id", "scaleId", "dimension", "minScore", "maxScore", "level", "color", "suggestion")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
            [scaleId, range.dim, range.min, range.max, range.level, range.color, range.suggestion]
          );
        }
        console.log(`    ✅ ${scale.name}`);
      }
    }

    const roleCount = (await client.query(`SELECT COUNT(*) as c FROM "roles"`)).rows[0].c;
    const userCount = (await client.query(`SELECT COUNT(*) as c FROM "users"`)).rows[0].c;
    const permCount = (await client.query(`SELECT COUNT(*) as c FROM "permissions"`)).rows[0].c;

    if (parseInt(roleCount) >= 4 && parseInt(userCount) >= 2 && parseInt(permCount) >= 20) {
      console.log('  ✅ 初始数据完整');
      return true;
    } else {
      console.log(`  ⚠️ 数据不完整 roles=${roleCount} users=${userCount} perms=${permCount}`);
      return false;
    }
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
    const dbDir = path.join(DATA_DIR, 'db');
    if (fs.existsSync(dbDir)) {
      try { fs.chmodSync(dbDir, 0o700); } catch {}
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

  if (needsRestart) {
    console.log('  🔄 更新已应用，正在重启...');
    try { await pg.stop(); } catch {}
    const nodeExe = getNodePath();
    const script = __filename;
    const child = spawn(nodeExe, [script], {
      cwd: APP_DIR,
      env: { ...process.env },
      stdio: 'inherit',
      detached: true,
    });
    child.unref();
    process.exit(0);
  }

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
  console.error('❌ 启动失败:', err?.message || err);
  console.error('');
  process.exit(1);
});
