import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/http-exception.filter';
import request from 'supertest';

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

export async function createScale(
  server: any,
  accessToken: string,
  name = 'E2E Test Scale',
): Promise<any> {
  const res = await request(server)
    .post('/api/scales')
    .set(authHeader(accessToken))
    .send({
      name,
      version: '1.0',
      description: 'E2E test scale',
      items: [
        {
          itemText: 'I feel anxious',
          sortOrder: 0,
          options: [
            { optionText: 'Never', scoreValue: 0, sortOrder: 0 },
            { optionText: 'Sometimes', scoreValue: 1, sortOrder: 1 },
            { optionText: 'Always', scoreValue: 2, sortOrder: 2 },
          ],
        },
      ],
      scoringRules: [{ formulaType: 'sum', weight: 1 }],
      scoreRanges: [
        { minScore: 0, maxScore: 0, level: 'normal', color: 'green', suggestion: 'OK' },
        { minScore: 1, maxScore: 2, level: 'mild', color: 'yellow', suggestion: 'Watch' },
      ],
    })
    .expect(201);

  return res.body;
}
