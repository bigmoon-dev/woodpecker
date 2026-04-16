import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScaleVersionAndValidation1700000000006 implements MigrationInterface {
  name = 'AddScaleVersionAndValidation1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scales" ADD "parent_scale_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "scales" ADD "version_status" character varying(20) NOT NULL DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `ALTER TABLE "scales" ADD "published_at" timestamp NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "scales" ADD CONSTRAINT "FK_scales_parentScaleId" FOREIGN KEY ("parent_scale_id") REFERENCES "scales"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scales_parentScaleId" ON "scales" ("parent_scale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scales_versionStatus" ON "scales" ("version_status")`,
    );

    await queryRunner.query(
      `UPDATE "scales" SET "version_status" = 'published', "published_at" = NOW() WHERE "status" = 'active'`,
    );

    await queryRunner.query(`
      CREATE TABLE "scale_validations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scale_id" uuid NOT NULL,
        "reliability_type" character varying(30) NOT NULL,
        "reliability_value" double precision NOT NULL,
        "validity_type" character varying(30) NOT NULL,
        "validity_detail" text,
        "sample_size" integer,
        "population" text,
        "reference_source" text,
        "validated_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "updated_at" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_scale_validations_scaleId" FOREIGN KEY ("scale_id") REFERENCES "scales"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_scale_validations_scaleId" ON "scale_validations" ("scale_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scale_validations"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_scales_versionStatus"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_scales_parentScaleId"`);
    await queryRunner.query(
      `ALTER TABLE "scales" DROP CONSTRAINT IF EXISTS "FK_scales_parentScaleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scales" DROP COLUMN IF EXISTS "published_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scales" DROP COLUMN IF EXISTS "version_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scales" DROP COLUMN IF EXISTS "parent_scale_id"`,
    );
  }
}
