import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  login,
  getReauthToken,
  authHeader,
  reauthHeaders,
} from '../helpers/test-app';
import type { TestContext } from '../helpers/test-app';
import { ResourceTracker } from '../helpers/resource-tracker';
import { ReportGenerator } from '../helpers/report-generator';

const tracker = new ResourceTracker();
const reporter = new ReportGenerator();

describe('Black-box E2E — Isolated Test DB', () => {
  let ctx: TestContext;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const tokens = await login(ctx.server);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;

    const scalesRes = await request(ctx.server)
      .get('/api/scales')
      .set(authHeader(accessToken));
    reporter.setScaleCountBefore(scalesRes.body?.total ?? 0);
  });

  afterAll(async () => {
    const scalesRes = await request(ctx.server)
      .get('/api/scales')
      .set(authHeader(accessToken));
    reporter.setScaleCountAfter(scalesRes.body?.total ?? 0);

    reporter.generate();
    await closeTestApp();
  });

  describe('Auth: Login', () => {
    it('rejects invalid credentials', async () => {
      await request(ctx.server)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401);
    });

    it('login returns tokens + user', async () => {
      const res = await request(ctx.server)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.username).toBe('admin');

      reporter.addJourney({
        name: 'Auth: Login',
        passed: true,
        steps: [
          { label: 'POST /auth/login (invalid)', status: 'PASS', duration: 0 },
          { label: 'POST /auth/login (valid)', status: 'PASS', duration: 0 },
        ],
      });
    });
  });

  describe('Auth: Token validation', () => {
    it('GET /me works with valid token', async () => {
      const res = await request(ctx.server)
        .get('/api/auth/me')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.username).toBe('admin');
    });

    it('GET /me rejects no token', async () => {
      await request(ctx.server).get('/api/auth/me').expect(401);
    });

    it('GET /me rejects invalid token', async () => {
      await request(ctx.server)
        .get('/api/auth/me')
        .set(authHeader('bad.token.here'))
        .expect(401);
    });
  });

  describe('Auth: Reauth + Preferences', () => {
    it('reauth succeeds', async () => {
      const res = await request(ctx.server)
        .post('/api/auth/reauth')
        .set(authHeader(accessToken))
        .send({ password: 'admin123' })
        .expect(201);
      expect(res.body.reauthToken).toBeDefined();
    });

    it('reauth fails with wrong password', async () => {
      await request(ctx.server)
        .post('/api/auth/reauth')
        .set(authHeader(accessToken))
        .send({ password: 'wrong' })
        .expect(401);
    });

    it('preferences round-trip', async () => {
      await request(ctx.server)
        .put('/api/auth/preferences')
        .set(authHeader(accessToken))
        .send({ theme: 'forest' })
        .expect(200);

      const res = await request(ctx.server)
        .get('/api/auth/preferences')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.theme).toBe('forest');
    });
  });

  describe('Scale: full lifecycle', () => {
    let scaleId: string;

    it('creates scale', async () => {
      const res = await request(ctx.server)
        .post('/api/scales')
        .set(authHeader(accessToken))
        .send({
          name: 'E2E Test Scale',
          version: '1.0',
          items: [
            {
              itemText: 'Q1',
              sortOrder: 0,
              options: [
                { optionText: 'A', scoreValue: 0, sortOrder: 0 },
                { optionText: 'B', scoreValue: 1, sortOrder: 1 },
              ],
            },
          ],
          scoringRules: [{ formulaType: 'sum', weight: 1 }],
          scoreRanges: [
            { minScore: 0, maxScore: 0, level: 'normal', color: 'green', suggestion: 'OK' },
            { minScore: 1, maxScore: 1, level: 'mild', color: 'yellow', suggestion: 'Watch' },
          ],
        })
        .expect(201);

      scaleId = res.body.id;
      tracker.addScale(scaleId);
      expect(scaleId).toBeDefined();
    });

    it('lists scales', async () => {
      const res = await request(ctx.server)
        .get('/api/scales')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.data.some((s: any) => s.id === scaleId)).toBe(true);
    });

    it('gets scale by id', async () => {
      const res = await request(ctx.server)
        .get(`/api/scales/${scaleId}`)
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.id).toBe(scaleId);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('updates scale', async () => {
      const res = await request(ctx.server)
        .put(`/api/scales/${scaleId}`)
        .set(authHeader(accessToken))
        .send({
          name: 'E2E Updated',
          items: [
            {
              itemText: 'Q1u',
              sortOrder: 0,
              options: [{ optionText: 'X', scoreValue: 0, sortOrder: 0 }],
            },
          ],
        })
        .expect(200);
      expect(res.body.name).toBe('E2E Updated');
    });

    it('publishes scale', async () => {
      const res = await request(ctx.server)
        .post(`/api/scales/${scaleId}/publish`)
        .set(authHeader(accessToken))
        .expect(201);
      expect(res.body.versionStatus).toBe('published');
    });

    it('rejects edit of published', async () => {
      await request(ctx.server)
        .put(`/api/scales/${scaleId}`)
        .set(authHeader(accessToken))
        .send({
          name: 'Blocked',
          items: [
            {
              itemText: 'Q1',
              sortOrder: 0,
              options: [{ optionText: 'A', scoreValue: 0, sortOrder: 0 }],
            },
          ],
        })
        .expect(400);
    });

    it('creates version from published', async () => {
      const res = await request(ctx.server)
        .post(`/api/scales/${scaleId}/create-version`)
        .set(authHeader(accessToken))
        .expect(201);
      expect(res.body.parentScaleId).toBe(scaleId);
      tracker.addVersion(res.body.id);
    });

    it('deletes version then original', async () => {
      const reToken = await getReauthToken(ctx.server, accessToken);
      const headers = reauthHeaders(accessToken, reToken);

      for (const vId of tracker.getVersionIds()) {
        await request(ctx.server)
          .delete(`/api/scales/${vId}`)
          .set(headers)
          .expect(200);
      }
      tracker.versionIds.length = 0;

      await request(ctx.server)
        .delete(`/api/scales/${scaleId}`)
        .set(headers)
        .expect(200);
      tracker.scaleIds.length = 0;
    });

    it('confirms scale gone', async () => {
      const res = await request(ctx.server)
        .get('/api/scales')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.data.some((s: any) => s.id === scaleId)).toBe(false);
    });
  });

  describe('Alert list', () => {
    it('returns paginated data', async () => {
      const res = await request(ctx.server)
        .get('/api/alerts')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeDefined();
    });
  });

  describe('Auth: Refresh + Logout', () => {
    it('rotates refresh token', async () => {
      const res = await request(ctx.server)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(201);
      const oldToken = refreshToken;
      refreshToken = res.body.refreshToken;

      await request(ctx.server)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldToken })
        .expect(401);
    });

    it('logout', async () => {
      const tokens = await login(ctx.server);
      const res = await request(ctx.server)
        .post('/api/auth/logout')
        .send({ refreshToken: tokens.refreshToken })
        .expect(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Post-cleanup verification', () => {
    it('no test scales remain', async () => {
      const res = await request(ctx.server)
        .get('/api/scales')
        .set(authHeader(accessToken))
        .expect(200);
      const names = res.body.data.map((s: any) => s.name);
      const e2eNames = names.filter(
        (n: string) => n.includes('E2E') || n.includes('Updated'),
      );
      expect(e2eNames).toEqual([]);
    });
  });
});
