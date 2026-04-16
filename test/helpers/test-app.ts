import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/http-exception.filter';
import request from 'supertest';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../e2e-resources/.env.e2e') });

export interface TestContext {
  app: INestApplication;
  server: any;
}

let appInstance: INestApplication | null = null;

export async function createTestApp(): Promise<TestContext> {
  if (appInstance) {
    return { app: appInstance, server: appInstance.getHttpServer() };
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  appInstance = moduleFixture.createNestApplication();
  appInstance.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  appInstance.useGlobalFilters(new AllExceptionsFilter());
  await appInstance.init();

  return { app: appInstance, server: appInstance.getHttpServer() };
}

export async function closeTestApp(): Promise<void> {
  if (appInstance) {
    await appInstance.close();
    appInstance = null;
  }
}

export async function login(
  server: any,
  username = 'admin',
  password = 'admin123',
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(server)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(201);

  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

export async function getReauthToken(
  server: any,
  accessToken: string,
  password = 'admin123',
): Promise<string> {
  const res = await request(server)
    .post('/api/auth/reauth')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ password })
    .expect(201);

  return res.body.reauthToken;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function reauthHeaders(
  accessToken: string,
  reauthToken: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Reauth-Token': reauthToken,
  };
}
