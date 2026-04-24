import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrantPsychologistAdminAll1700000000010 implements MigrationInterface {
  name = 'GrantPsychologistAdminAll1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id"
      FROM "roles" r, "permissions" p
      WHERE r."name" IN ('psychologist', '心理老师') AND p."code" = 'admin:all'
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "role_permissions" ("roleId", "permissionId")
      SELECT r."id", p."id"
      FROM "roles" r, "permissions" p
      WHERE r."name" IN ('psychologist', '心理老师') AND p."code" IN (
        'role:write', 'plugin:write', 'config:write',
        'user:read', 'user:write', 'role:read',
        'student:read', 'student:write',
        'dashboard:read', 'interview:read', 'interview:write',
        'export:read', 'followup:read', 'followup:write',
        'task:delete', 'scale:delete', 'audit:read'
      )
      ON CONFLICT ("roleId", "permissionId") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "students"
      SET "encryptedName" = NULL
      WHERE "encryptedName" IS NOT NULL
      AND LEFT("encryptedName"::text, 1) = '{'
    `);

    await queryRunner.query(`
      UPDATE "students"
      SET "encryptedStudentNumber" = NULL
      WHERE "encryptedStudentNumber" IS NOT NULL
      AND LEFT("encryptedStudentNumber"::text, 1) = '{'
    `);

    await queryRunner.query(`
      UPDATE "students"
      SET "encryptedContact" = NULL
      WHERE "encryptedContact" IS NOT NULL
      AND LEFT("encryptedContact"::text, 1) = '{'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permissions"
      WHERE "roleId" = (SELECT "id" FROM "roles" WHERE "name" IN ('psychologist', '心理老师'))
      AND "permissionId" = (SELECT "id" FROM "permissions" WHERE "code" = 'admin:all')
    `);
  }
}
