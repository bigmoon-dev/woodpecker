import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAlertNotifications1700000000002 implements MigrationInterface {
  name = 'AddAlertNotifications1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alert_notifications" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "alertId" UUID NOT NULL REFERENCES "alert_records"("id"),
        "targetUserId" UUID NOT NULL REFERENCES "users"("id"),
        "targetRole" VARCHAR(50) NOT NULL,
        "read" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_alert_notifications_user ON "alert_notifications"("targetUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX idx_alert_notifications_alert ON "alert_notifications"("alertId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "alert_notifications"`);
  }
}
