import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedScaleLibrary } from '../seed/scale-library.seed';

export class AddScaleLibraryField1700000000004 implements MigrationInterface {
  name = 'AddScaleLibraryField1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scales" ADD "is_library" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scales_is_library" ON "scales" ("is_library")`,
    );

    await seedScaleLibrary(queryRunner.connection);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scales" WHERE "is_library" = true`);
    await queryRunner.query(`DROP INDEX "idx_scales_is_library"`);
    await queryRunner.query(`ALTER TABLE "scales" DROP COLUMN "is_library"`);
  }
}
