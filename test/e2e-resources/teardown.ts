import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const TEST_DB = process.env.DB_DATABASE!;

export default async function () {
  console.log(`[E2E Teardown] Dropping test database: ${TEST_DB}`);
  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!, 10),
    username: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: 'postgres',
  });
  await admin.initialize();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}'`,
    );
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
    console.log('[E2E Teardown] Test database dropped');
  } finally {
    await admin.destroy();
  }
}
