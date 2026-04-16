import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserLockoutFields1700000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'failedLoginCount',
        type: 'integer',
        default: 0,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lockedUntil',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'lockedUntil');
    await queryRunner.dropColumn('users', 'failedLoginCount');
  }
}
