import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportTemplate1700000000007 implements MigrationInterface {
  name = 'AddReportTemplate1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "report_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" character varying(200) NOT NULL,
        "description" text,
        "type" character varying(30) NOT NULL DEFAULT 'group',
        "schema" jsonb NOT NULL,
        "is_built_in" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT NOW(),
        "updated_at" timestamp NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "report_templates" ("name", "description", "type", "schema", "is_built_in")
      VALUES (
        '班级心理测评分析报告',
        '内置模板：概览统计 + 分数分布 + 预警分布 + 维度对比 + 建议',
        'group',
        '{"sections": [
          {"type": "overview", "title": "概览统计", "fields": ["totalStudents", "avgScore", "stdDev"]},
          {"type": "distribution", "title": "等级分布", "fields": ["levelDistribution", "colorDistribution"]},
          {"type": "dimensions", "title": "维度均值", "fields": ["dimensionAverages"]},
          {"type": "suggestions", "title": "建议", "fields": ["suggestion"]}
        ]}'::jsonb,
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_templates"`);
  }
}
