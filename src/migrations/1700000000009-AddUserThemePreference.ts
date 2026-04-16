import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserThemePreference1700000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'themePreference',
        type: 'character varying',
        length: '30',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'themePreference');
  }
}
