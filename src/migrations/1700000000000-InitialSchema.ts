import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "grades" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(50) NOT NULL,
        "sortOrder" integer NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" character varying(100) NOT NULL,
        "password" character varying NOT NULL,
        "displayName" character varying(50) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "studentId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`,
    );

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(50) NOT NULL,
        "description" text,
        "isSystem" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "UQ_roles_name" UNIQUE ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" character varying(80) NOT NULL,
        "name" character varying(100) NOT NULL,
        "category" character varying(30) NOT NULL,
        "description" text
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "UQ_permissions_code" UNIQUE ("code")`,
    );

    await queryRunner.query(`
      CREATE TABLE "scales" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(200) NOT NULL,
        "version" character varying(20) NOT NULL DEFAULT '1.0',
        "description" text,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "source" character varying(200),
        "validationInfo" character varying(500),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "plugins" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(100) NOT NULL,
        "version" character varying(20) NOT NULL DEFAULT '1.0.0',
        "description" text,
        "status" character varying(20) NOT NULL DEFAULT 'installed',
        "config" jsonb,
        "settingsSchema" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "plugins" ADD CONSTRAINT "UQ_plugins_name" UNIQUE ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "plugin_hooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pluginId" uuid NOT NULL,
        "event" character varying(100) NOT NULL,
        "description" character varying(200),
        "priority" integer NOT NULL DEFAULT 100,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "plugin_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pluginName" character varying(100) NOT NULL,
        "level" character varying(20) NOT NULL DEFAULT 'info',
        "message" text NOT NULL,
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "plugin_hooks"
        ADD CONSTRAINT "FK_plugin_hooks_plugin"
        FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid,
        "action" character varying(50) NOT NULL,
        "resourceType" character varying(50) NOT NULL,
        "resourceId" uuid,
        "detail" jsonb,
        "ip" character varying(45),
        "userAgent" character varying(500),
        "createdAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING`,
    );
    await queryRunner.query(
      `CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING`,
    );

    await queryRunner.query(`
      CREATE TABLE "alert_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "resultId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "level" character varying(10) NOT NULL DEFAULT 'red',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "handledById" uuid,
        "handleNote" text,
        "handledAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "classes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "gradeId" uuid NOT NULL,
        "name" character varying(50) NOT NULL,
        "sortOrder" integer NOT NULL,
        CONSTRAINT "FK_classes_gradeId" FOREIGN KEY ("gradeId") REFERENCES "grades"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("userId", "roleId"),
        CONSTRAINT "FK_user_roles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "roleId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("roleId", "permissionId"),
        CONSTRAINT "FK_role_permissions_roleId" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_role_permissions_permissionId" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "scale_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scaleId" uuid NOT NULL,
        "itemText" text NOT NULL,
        "itemType" character varying(30) NOT NULL DEFAULT 'single_choice',
        "sortOrder" integer NOT NULL,
        "dimension" character varying(100),
        "reverseScore" boolean NOT NULL DEFAULT false,
        CONSTRAINT "FK_scale_items_scaleId" FOREIGN KEY ("scaleId") REFERENCES "scales"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "scoring_rules" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scaleId" uuid NOT NULL,
        "dimension" character varying(100),
        "formulaType" character varying(30) NOT NULL DEFAULT 'sum',
        "weight" double precision NOT NULL DEFAULT 1,
        "config" jsonb,
        CONSTRAINT "FK_scoring_rules_scaleId" FOREIGN KEY ("scaleId") REFERENCES "scales"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "score_ranges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scaleId" uuid NOT NULL,
        "dimension" character varying(100),
        "minScore" double precision NOT NULL,
        "maxScore" double precision NOT NULL,
        "level" character varying(20) NOT NULL,
        "color" character varying(10) NOT NULL DEFAULT 'green',
        "suggestion" text,
        CONSTRAINT "FK_score_ranges_scaleId" FOREIGN KEY ("scaleId") REFERENCES "scales"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "students" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "classId" uuid NOT NULL,
        "encryptedName" bytea,
        "encryptedStudentNumber" bytea,
        "encryptedContact" bytea,
        "gender" character varying(10),
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_students_classId" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "scale_options" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId" uuid NOT NULL,
        "optionText" text NOT NULL,
        "scoreValue" integer NOT NULL,
        "sortOrder" integer NOT NULL,
        CONSTRAINT "FK_scale_options_itemId" FOREIGN KEY ("itemId") REFERENCES "scale_items"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scaleId" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "targetIds" jsonb NOT NULL,
        "targetType" character varying(20) NOT NULL DEFAULT 'grade',
        "deadline" timestamp,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "createdById" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_tasks_scaleId" FOREIGN KEY ("scaleId") REFERENCES "scales"("id"),
        CONSTRAINT "FK_tasks_createdById" FOREIGN KEY ("createdById") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "consent_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "studentId" uuid,
        "consentType" character varying(50) NOT NULL,
        "contentHash" character varying(64) NOT NULL,
        "signedAt" timestamp NOT NULL,
        "ip" character varying(45),
        CONSTRAINT "FK_consent_records_userId" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "task_answers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "taskId" uuid NOT NULL,
        "studentId" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'in_progress',
        "startedAt" timestamp NOT NULL DEFAULT NOW(),
        "submittedAt" timestamp,
        CONSTRAINT "FK_task_answers_taskId" FOREIGN KEY ("taskId") REFERENCES "tasks"("id"),
        CONSTRAINT "FK_task_answers_studentId" FOREIGN KEY ("studentId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "task_answer_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "answerId" uuid NOT NULL,
        "itemId" uuid NOT NULL,
        "optionId" uuid,
        "score" integer NOT NULL DEFAULT 0,
        CONSTRAINT "FK_task_answer_items_answerId" FOREIGN KEY ("answerId") REFERENCES "task_answers"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "task_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "answerId" uuid NOT NULL,
        "totalScore" double precision NOT NULL,
        "dimensionScores" jsonb,
        "level" character varying(20) NOT NULL,
        "color" character varying(10) NOT NULL DEFAULT 'green',
        "suggestion" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_task_results_answerId" FOREIGN KEY ("answerId") REFERENCES "task_answers"("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_classes_gradeId" ON "classes"("gradeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_users_studentId" ON "users"("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scale_items_scaleId" ON "scale_items"("scaleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scale_options_itemId" ON "scale_options"("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_scoring_rules_scaleId" ON "scoring_rules"("scaleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_score_ranges_scaleId" ON "score_ranges"("scaleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_students_classId" ON "students"("classId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_scaleId" ON "tasks"("scaleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_createdById" ON "tasks"("createdById")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_status" ON "tasks"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consent_records_userId" ON "consent_records"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_consent_records_studentId" ON "consent_records"("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_answers_taskId" ON "task_answers"("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_answers_studentId" ON "task_answers"("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_answers_status" ON "task_answers"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_answer_items_answerId" ON "task_answer_items"("answerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_answer_items_itemId" ON "task_answer_items"("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_task_results_answerId" ON "task_results"("answerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_userId" ON "audit_logs"("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_resourceType" ON "audit_logs"("resourceType")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_createdAt" ON "audit_logs"("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_alert_records_resultId" ON "alert_records"("resultId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_alert_records_studentId" ON "alert_records"("studentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_alert_records_status" ON "alert_records"("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "task_results"`);
    await queryRunner.query(`DROP TABLE "task_answer_items"`);
    await queryRunner.query(`DROP TABLE "task_answers"`);
    await queryRunner.query(`DROP TABLE "consent_records"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "scale_options"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(`DROP TABLE "score_ranges"`);
    await queryRunner.query(`DROP TABLE "scoring_rules"`);
    await queryRunner.query(`DROP TABLE "scale_items"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "classes"`);
    await queryRunner.query(`DROP TABLE "alert_records"`);
    await queryRunner.query(`DROP RULE audit_logs_no_update ON audit_logs`);
    await queryRunner.query(`DROP RULE audit_logs_no_delete ON audit_logs`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "plugin_hooks"`);
    await queryRunner.query(`DROP TABLE "plugin_logs"`);
    await queryRunner.query(`DROP TABLE "plugins"`);
    await queryRunner.query(`DROP TABLE "scales"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "grades"`);
  }
}
