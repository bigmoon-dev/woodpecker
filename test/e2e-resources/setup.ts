import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const TEST_DB = process.env.DB_DATABASE!;

async function makeDs(db: string) {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: db,
  });
  return ds.initialize();
}

export default async function () {
  console.log(`[E2E Setup] Creating test database: ${TEST_DB}`);
  const admin = await makeDs('postgres');
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    await admin.query(`CREATE DATABASE "${TEST_DB}"`);
    console.log('[E2E Setup] Database created');
  } finally {
    await admin.destroy();
  }

  console.log('[E2E Setup] Initializing schema via TypeORM synchronize...');
  const entities = require('../../src/entities');
  const entityClasses = Object.values(entities).filter(
    (e: any) => typeof e === 'function' && e.prototype,
  );

  const syncDs = new DataSource({
    type: 'postgres' as any,
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: TEST_DB,
    synchronize: true,
    entities: entityClasses,
  });
  await syncDs.initialize();
  await syncDs.synchronize();
  console.log('[E2E Setup] Schema synchronized');

  const bcrypt = await import('bcrypt');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await syncDs.query(`
    INSERT INTO "permissions" ("id", "code", "name", "category", "description")
    VALUES
      (gen_random_uuid(), 'scale:read', '查看量表', 'scale', '查看量表信息'),
      (gen_random_uuid(), 'scale:write', '管理量表', 'scale', '创建编辑删除量表'),
      (gen_random_uuid(), 'task:read', '查看任务', 'task', '查看任务信息'),
      (gen_random_uuid(), 'task:write', '管理任务', 'task', '创建编辑删除任务'),
      (gen_random_uuid(), 'task:submit', '提交任务', 'task', '提交任务答卷'),
      (gen_random_uuid(), 'result:read', '查看结果', 'result', '查看测评结果'),
      (gen_random_uuid(), 'alert:read', '查看预警', 'alert', '查看预警记录'),
      (gen_random_uuid(), 'alert:write', '处理预警', 'alert', '处理预警记录'),
      (gen_random_uuid(), 'org:read', '查看组织', 'org', '查看组织架构'),
      (gen_random_uuid(), 'org:write', '管理组织', 'org', '管理组织架构'),
      (gen_random_uuid(), 'admin:all', '系统管理', 'admin', '系统管理全部权限'),
      (gen_random_uuid(), 'consent:read', '查看知情同意', 'consent', '查看知情同意'),
      (gen_random_uuid(), 'consent:write', '签署知情同意', 'consent', '签署知情同意'),
      (gen_random_uuid(), 'plugin:read', '查看插件', 'plugin', '查看插件信息'),
      (gen_random_uuid(), 'plugin:write', '管理插件', 'plugin', '管理插件配置'),
      (gen_random_uuid(), 'interview:read', '查看访谈', 'interview', '查看访谈记录'),
      (gen_random_uuid(), 'interview:write', '管理访谈', 'interview', '创建编辑删除访谈')
    ON CONFLICT ("code") DO NOTHING
  `);

  await syncDs.query(`
    INSERT INTO "roles" ("id", "name", "description", "isSystem")
    VALUES
      (gen_random_uuid(), '系统管理员', '系统管理员拥有全部权限', true),
      (gen_random_uuid(), '心理老师', '心理老师负责量表管理和测评任务', true),
      (gen_random_uuid(), '班主任', '班主任查看班级相关数据', true),
      (gen_random_uuid(), '学生', '学生参与测评任务', true)
    ON CONFLICT ("name") DO NOTHING
  `);

  await syncDs.query(`
    INSERT INTO "role_permissions" ("roleId", "permissionId")
    SELECT r."id", p."id" FROM "roles" r, "permissions" p
    WHERE r."name" = '系统管理员'
    ON CONFLICT ("roleId", "permissionId") DO NOTHING
  `);

  await syncDs.query(`
    INSERT INTO "users" ("id", "username", "password", "displayName", "status")
    VALUES (gen_random_uuid(), 'admin', $1, '系统管理员', 'active')
    ON CONFLICT ("username") DO NOTHING
  `, [hashedPassword]);

  await syncDs.query(`
    INSERT INTO "user_roles" ("userId", "roleId")
    SELECT u."id", r."id" FROM "users" u, "roles" r
    WHERE u."username" = 'admin' AND r."name" = '系统管理员'
    ON CONFLICT ("userId", "roleId") DO NOTHING
  `);

  console.log('[E2E Setup] Seed data inserted');

  const users = await syncDs.query(
    "SELECT username FROM users WHERE username = 'admin'",
  );
  if (users.length === 0) {
    throw new Error('[E2E Setup] admin user not found after seed');
  }
  console.log('[E2E Setup] Verified: admin user exists');

  await syncDs.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL PRIMARY KEY,
      "timestamp" BIGINT NOT NULL,
      "name" VARCHAR NOT NULL
    )
  `);

  const migrationRecords = [
    { ts: 1700000000000, name: 'InitialSchema1700000000000' },
    { ts: 1700000000001, name: 'SeedRolesPermissions1700000000001' },
    { ts: 1700000000002, name: 'AddAlertNotifications1700000000002' },
    { ts: 1700000000003, name: 'AddStudentNumberHashAndUniqueConstraints1700000000003' },
    { ts: 1700000000004, name: 'AddScaleLibraryField1700000000004' },
    { ts: 1700000000005, name: 'AddSystemConfig1700000000005' },
    { ts: 1700000000006, name: 'AddScaleVersionAndValidation1700000000006' },
    { ts: 1700000000007, name: 'AddReportTemplate1700000000007' },
    { ts: 1700000000008, name: 'AddUserLockoutFields1700000000008' },
    { ts: 1700000000009, name: 'AddUserThemePreference1700000000009' },
  ];

  for (const m of migrationRecords) {
    await syncDs.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [m.ts, m.name],
    );
  }
  console.log('[E2E Setup] Migration records inserted');

  await syncDs.destroy();
}
