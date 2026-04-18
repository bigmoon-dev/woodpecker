import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedScaleLibrary } from '../seed/scale-library.seed.js';

export class AddScaleLibraryField1700000000004 implements MigrationInterface {
  name = 'AddScaleLibraryField1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scales" ADD "isLibrary" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scales_is_library" ON "scales" ("isLibrary")`,
    );

    try {
      await seedScaleLibrary(queryRunner.connection);
    } catch (err) {
      console.warn('Scale library seeding skipped:', (err as Error).message);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "scales" WHERE "isLibrary" = true`);
    await queryRunner.query(`DROP INDEX "idx_scales_is_library"`);
    await queryRunner.query(`ALTER TABLE "scales" DROP COLUMN "isLibrary"`);
  }
}
