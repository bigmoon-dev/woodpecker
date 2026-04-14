import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentNumberHashAndUniqueConstraints1700000000003 implements MigrationInterface {
  name = 'AddStudentNumberHashAndUniqueConstraints1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students"
      ADD COLUMN IF NOT EXISTS "studentNumberHash" VARCHAR(64) NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_students_studentNumberHash"
      ON "students" ("studentNumberHash")
      WHERE "studentNumberHash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_grades_name"
      ON "grades" ("name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_classes_gradeId_name"
      ON "classes" ("gradeId", "name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_classes_gradeId_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_grades_name"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_students_studentNumberHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP COLUMN IF EXISTS "studentNumberHash"`,
    );
  }
}
