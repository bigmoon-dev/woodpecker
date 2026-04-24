import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameRoleNames1700000000011 implements MigrationInterface {
  name = 'RenameRoleNames1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "roles" SET "name" = 'admin', "displayName" = '系统管理员'
      WHERE "name" = '系统管理员' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = 'psychologist', "displayName" = '心理老师'
      WHERE "name" = '心理老师' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = 'teacher', "displayName" = '班主任'
      WHERE "name" = '班主任' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = 'student', "displayName" = '学生'
      WHERE "name" = '学生' AND "isSystem" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "roles" SET "name" = '系统管理员' WHERE "name" = 'admin' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = '心理老师' WHERE "name" = 'psychologist' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = '班主任' WHERE "name" = 'teacher' AND "isSystem" = true
    `);
    await queryRunner.query(`
      UPDATE "roles" SET "name" = '学生' WHERE "name" = 'student' AND "isSystem" = true
    `);
  }
}
