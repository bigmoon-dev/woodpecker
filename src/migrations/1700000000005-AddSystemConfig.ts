import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddSystemConfig1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'system_config',
        columns: [
          { name: 'key', type: 'varchar', isPrimary: true },
          { name: 'value', type: 'text' },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            default: "'general'",
          },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'valueType',
            type: 'varchar',
            length: '20',
            default: "'string'",
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          { name: 'updatedBy', type: 'varchar', isNullable: true },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('system_config');
  }
}
