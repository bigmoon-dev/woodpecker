import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRolesPermissions1700000000001 implements MigrationInterface {
  name = 'SeedRolesPermissions1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "permissions" ("id", "code", "name", "category", "description")
      VALUES
        (gen_random_uuid(), 'scale:read', '查看量表', 'scale', '查看量表信息'),
        (gen_random_uuid(), 'scale:write', '管理量表', 'scale', '创建、编辑、删除量表'),
        (gen_random_uuid(), 'task:read', '查看任务', 'task', '查看任务信息'),
        (gen_random_uuid(), 'task:write', '管理任务', 'task', '创建、编辑、删除任务'),
        (gen_random_uuid(), 'task:submit', '提交任务', 'task', '提交任务答卷'),
        (gen_random_uuid(), 'result:read', '查看结果', 'result', '查看测评结果'),
        (gen_random_uuid(), 'alert:read', '查看预警', 'alert', '查看预警记录'),
        (gen_random_uuid(), 'alert:write', '处理预警', 'alert', '处理预警记录'),
        (gen_random_uuid(), 'org:read', '查看组织', 'org', '查看组织架构'),
        (gen_random_uuid(), 'org:write', '管理组织', 'org', '管理组织架构'),
        (gen_random_uuid(), 'admin:all', '系统管理', 'admin', '系统管理全部权限'),
        (gen_random_uuid(), 'consent:read', '查看知情同意', 'consent', '查看知情同意记录'),
        (gen_random_uuid(), 'consent:write', '签署知情同意', 'consent', '签署知情同意'),
        (gen_random_uuid(), 'plugin:read', '查看插件', 'plugin', '查看插件信息'),
        (gen_random_uuid(), 'plugin:write', '管理插件', 'plugin', '管理插件配置')
      ON CONFLICT ("code") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "roles" ("id", "name", "description", "isSystem")
      VALUES
        (gen_random_uuid(), '系统管理员', '系统管理员，拥有全部权限', true),
        (gen_random_uuid(), '心理老师', '心理老师，负责量表管理和测评任务', true),
        (gen_random_uuid(), '班主任', '班主任，查看班级相关数据', true),
        (gen_random_uuid(), '学生', '学生，参与测评任务', true)
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id" FROM "roles" r, "permissions" p
      WHERE r."name" = '系统管理员'
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id" FROM "roles" r, "permissions" p
      WHERE r."name" = '心理老师' AND p."code" IN (
        'scale:read', 'scale:write',
        'task:read', 'task:write', 'task:submit',
        'result:read',
        'alert:read', 'alert:write',
        'consent:read', 'consent:write',
        'plugin:read'
      )
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id" FROM "roles" r, "permissions" p
      WHERE r."name" = '班主任' AND p."code" IN (
        'task:read', 'result:read', 'alert:read', 'consent:read'
      )
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id" FROM "roles" r, "permissions" p
      WHERE r."name" = '学生' AND p."code" IN (
        'task:submit', 'result:read', 'consent:read'
      )
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "users" ("id", "username", "password", "displayName", "status")
      VALUES (
        gen_random_uuid(),
        'admin',
        '$2b$10$6fpCy6AzEnC0frnktI0HS./nAmn1OAPWxn/q7593h8w92LI83T8OS',
        '系统管理员',
        'active'
      )
      ON CONFLICT ("username") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "user_roles" ("userId", "roleId")
      SELECT u."id", r."id" FROM "users" u, "roles" r
      WHERE u."username" = 'admin' AND r."name" = '系统管理员'
      ON CONFLICT ("userId", "roleId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_roles" WHERE "userId" IN (
        SELECT "id" FROM "users" WHERE "username" = 'admin'
      )
    `);
    await queryRunner.query(`DELETE FROM "users" WHERE "username" = 'admin'`);
    await queryRunner.query(`DELETE FROM "role_permissions" WHERE "roleId" IN (
      SELECT "id" FROM "roles" WHERE "isSystem" = true
    )`);
    await queryRunner.query(`DELETE FROM "roles" WHERE "isSystem" = true`);
    await queryRunner.query(`DELETE FROM "permissions" WHERE "code" IN (
      'scale:read', 'scale:write',
      'task:read', 'task:write', 'task:submit',
      'result:read',
      'alert:read', 'alert:write',
      'org:read', 'org:write',
      'admin:all',
      'consent:read', 'consent:write',
      'plugin:read', 'plugin:write'
    )`);
  }
}
