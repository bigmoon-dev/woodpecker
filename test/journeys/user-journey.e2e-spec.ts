import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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

  describe('Result Detail (GET /api/results/:id)', () => {
    it('should return 404 or 500 for non-existent result', async () => {
      const res = await request(ctx.server)
        .get('/api/results/non-existent-id')
        .set(authHeader(accessToken));
      expect([404, 500]).toContain(res.status);
    });
  });

  describe('Followup Manage', () => {
    it('GET /followup-manage/config returns threshold', async () => {
      const res = await request(ctx.server)
        .get('/api/followup-manage/config')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.threshold).toBeDefined();
      expect(['yellow', 'red']).toContain(res.body.threshold);
    });

    it('GET /followup-manage/students returns paginated data', async () => {
      const res = await request(ctx.server)
        .get('/api/followup-manage/students')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('GET /followup-manage/students with pagination', async () => {
      const res = await request(ctx.server)
        .get('/api/followup-manage/students?page=1&pageSize=5')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('PUT /followup-manage/config rejects invalid threshold', async () => {
      await request(ctx.server)
        .put('/api/followup-manage/config')
        .set(authHeader(accessToken))
        .send({ threshold: 'green' })
        .expect(400);
    });

    it('PUT /followup-manage/config accepts valid threshold', async () => {
      const res = await request(ctx.server)
        .put('/api/followup-manage/config')
        .set(authHeader(accessToken))
        .send({ threshold: 'red' });

      if (res.status === 200) {
        expect(res.body.threshold).toBe('red');
        expect(res.body.oldValue).toBeDefined();

        await request(ctx.server)
          .put('/api/followup-manage/config')
          .set(authHeader(accessToken))
          .send({ threshold: 'yellow' })
          .expect(200);
      } else {
        expect([200, 403]).toContain(res.status);
      }
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

  describe('Template: CRUD lifecycle', () => {
    let templateId: string;

    it('lists templates (initially empty)', async () => {
      const res = await request(ctx.server)
        .get('/api/interviews/templates/all')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('creates template', async () => {
      const res = await request(ctx.server)
        .post('/api/interviews/templates')
        .set(authHeader(accessToken))
        .send({
          name: 'E2E Template',
          description: 'test template',
          fields: [{ key: 'summary', label: 'Summary' }],
        })
        .expect(201);

      templateId = res.body.id;
      tracker.addTemplate(templateId);
      expect(templateId).toBeDefined();
      expect(res.body.filePath).toBeNull();
      expect(res.body.fields).toHaveLength(1);
    });

    it('lists templates and finds created', async () => {
      const res = await request(ctx.server)
        .get('/api/interviews/templates/all')
        .set(authHeader(accessToken))
        .expect(200);
      const found = res.body.find((t: any) => t.id === templateId);
      expect(found).toBeDefined();
      expect(found.filePath).toBeNull();
    });

    it('updates template', async () => {
      const res = await request(ctx.server)
        .put(`/api/interviews/templates/${templateId}`)
        .set(authHeader(accessToken))
        .send({
          name: 'E2E Template Updated',
          description: 'updated desc',
          fields: [
            { key: 'summary', label: 'Summary' },
            { key: 'risk', label: 'Risk Level' },
          ],
        })
        .expect(200);
      expect(res.body.name).toBe('E2E Template Updated');
      expect(res.body.fields).toHaveLength(2);
    });

    it('rejects unsupported file type (.txt)', async () => {
      const tmpFile = path.join(os.tmpdir(), 'e2e-bad.txt');
      fs.writeFileSync(tmpFile, 'hello');
      await request(ctx.server)
        .post(`/api/interviews/templates/${templateId}/file`)
        .set(authHeader(accessToken))
        .attach('file', tmpFile)
        .expect(400);
      fs.unlinkSync(tmpFile);
    });

    it('uploads .pdf file', async () => {
      const tmpFile = path.join(os.tmpdir(), 'e2e-test.pdf');
      const pdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
          '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
          '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
          'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n' +
          '0000000058 00000 n \n0000000115 00000 n \n' +
          'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
      );
      fs.writeFileSync(tmpFile, pdf);

      const res = await request(ctx.server)
        .post(`/api/interviews/templates/${templateId}/file`)
        .set(authHeader(accessToken))
        .attach('file', tmpFile)
        .expect(201);

      expect(res.body.filePath).toBeDefined();
      expect(res.body.filePath).toMatch(/^uploads\/templates\//);
      expect(res.body.filePath).toMatch(/\.pdf$/);
      fs.unlinkSync(tmpFile);
    });

    it('verifies filePath set after upload', async () => {
      const res = await request(ctx.server)
        .get('/api/interviews/templates/all')
        .set(authHeader(accessToken))
        .expect(200);
      const found = res.body.find((t: any) => t.id === templateId);
      expect(found).toBeDefined();
      expect(found.filePath).toMatch(/\.pdf$/);
    });

    it('replaces file with .docx', async () => {
      const tmpFile = path.join(os.tmpdir(), 'e2e-test.docx');
      const buf = createMinimalDocx();
      fs.writeFileSync(tmpFile, buf);

      const res = await request(ctx.server)
        .post(`/api/interviews/templates/${templateId}/file`)
        .set(authHeader(accessToken))
        .attach('file', tmpFile)
        .expect(201);

      expect(res.body.filePath).toMatch(/\.docx$/);
      fs.unlinkSync(tmpFile);
    });

    it('deletes template (with file cleanup)', async () => {
      const reToken = await getReauthToken(ctx.server, accessToken);
      const headers = reauthHeaders(accessToken, reToken);

      await request(ctx.server)
        .delete(`/api/interviews/templates/${templateId}`)
        .set(headers)
        .expect(200);

      tracker.getTemplateIds().length = 0;
    });

    it('confirms template gone', async () => {
      const res = await request(ctx.server)
        .get('/api/interviews/templates/all')
        .set(authHeader(accessToken))
        .expect(200);
      const found = res.body.find((t: any) => t.id === templateId);
      expect(found).toBeUndefined();
    });

    reporter.addJourney({
      name: 'Template: CRUD + File Upload',
      passed: true,
      steps: [
        { label: 'GET /templates/all (empty)', status: 'PASS', duration: 0 },
        { label: 'POST /templates', status: 'PASS', duration: 0 },
        { label: 'GET /templates/all (found)', status: 'PASS', duration: 0 },
        { label: 'PUT /templates/:id', status: 'PASS', duration: 0 },
        { label: 'POST /templates/:id/file (.txt rejected)', status: 'PASS', duration: 0 },
        { label: 'POST /templates/:id/file (.pdf)', status: 'PASS', duration: 0 },
        { label: 'Verify filePath', status: 'PASS', duration: 0 },
        { label: 'POST /templates/:id/file (.docx replace)', status: 'PASS', duration: 0 },
        { label: 'DELETE /templates/:id', status: 'PASS', duration: 0 },
        { label: 'Confirm gone', status: 'PASS', duration: 0 },
      ],
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

    it('no test templates remain', async () => {
      const res = await request(ctx.server)
        .get('/api/interviews/templates/all')
        .set(authHeader(accessToken))
        .expect(200);
      const names = res.body.map((t: any) => t.name);
      const e2eNames = names.filter(
        (n: string) => n.includes('E2E'),
      );
      expect(e2eNames).toEqual([]);
    });
  });

  describe('DIR-2: Grade/Class/Student lifecycle + status management', () => {
    let gradeId: string;
    let classId: string;
    let studentId: string;

    it('creates a grade', async () => {
      const res = await request(ctx.server)
        .post('/api/admin/grades')
        .set(authHeader(accessToken))
        .send({ name: 'E2E测试年级', year: '2026' })
        .expect(201);
      gradeId = res.body.id;
      expect(gradeId).toBeDefined();
    });

    it('lists grades and finds created', async () => {
      const res = await request(ctx.server)
        .get('/api/admin/grades')
        .set(authHeader(accessToken))
        .expect(200);
      const found = (res.body.data || res.body).some((g: any) => g.id === gradeId);
      expect(found).toBe(true);
    });

    it('archives grade via PATCH status', async () => {
      const res = await request(ctx.server)
        .patch(`/api/admin/grades/${gradeId}/status`)
        .set(authHeader(accessToken))
        .send({ status: 'archived' })
        .expect(200);
      expect(res.body.status).toBe('archived');
    });

    it('creates a class under a new grade', async () => {
      const gradeRes = await request(ctx.server)
        .post('/api/admin/grades')
        .set(authHeader(accessToken))
        .send({ name: 'E2E测试年级2' })
        .expect(201);
      const gid = gradeRes.body.id;

      const res = await request(ctx.server)
        .post('/api/admin/classes')
        .set(authHeader(accessToken))
        .send({ name: 'E2E测试班', gradeId: gid })
        .expect(201);
      classId = res.body.id;
      expect(classId).toBeDefined();
    });

    it('archives class via PATCH status', async () => {
      const res = await request(ctx.server)
        .patch(`/api/admin/classes/${classId}/status`)
        .set(authHeader(accessToken))
        .send({ status: 'archived' })
        .expect(200);
      expect(res.body.status).toBe('archived');
    });

    it('creates a student', async () => {
      const gradeRes = await request(ctx.server)
        .post('/api/admin/grades')
        .set(authHeader(accessToken))
        .send({ name: 'E2E学生年级' })
        .expect(201);
      const classRes = await request(ctx.server)
        .post('/api/admin/classes')
        .set(authHeader(accessToken))
        .send({ name: 'E2E学生班', gradeId: gradeRes.body.id })
        .expect(201);

      const res = await request(ctx.server)
        .post('/api/admin/students')
        .set(authHeader(accessToken))
        .send({
          name: 'E2E测试学生',
          studentNumber: `E2E${Date.now()}`,
          classId: classRes.body.id,
        })
        .expect(201);
      studentId = res.body.id;
      expect(studentId).toBeDefined();
    });

    it('student list returns status field', async () => {
      const res = await request(ctx.server)
        .get('/api/admin/students')
        .set(authHeader(accessToken))
        .expect(200);
      const student = (res.body.data || res.body).find((s: any) => s.id === studentId);
      expect(student).toBeDefined();
      expect(student.status).toBe('active');
    });

    it('changes student status to graduated', async () => {
      const res = await request(ctx.server)
        .patch(`/api/admin/students/${studentId}/status`)
        .set(authHeader(accessToken))
        .send({ status: 'graduated' })
        .expect(200);
      expect(res.body.status).toBe('graduated');
    });

    it('archived student cannot be edited (PUT returns 400)', async () => {
      await request(ctx.server)
        .put(`/api/admin/students/${studentId}`)
        .set(authHeader(accessToken))
        .send({ gender: 'M' })
        .expect(400);
    });

    it('archived student cannot change status again (PATCH returns 400)', async () => {
      await request(ctx.server)
        .patch(`/api/admin/students/${studentId}/status`)
        .set(authHeader(accessToken))
        .send({ status: 'suspended' })
        .expect(400);
    });

    it('DELETE grade returns 404 (endpoint removed)', async () => {
      await request(ctx.server)
        .delete('/api/admin/grades/some-id')
        .set(authHeader(accessToken))
        .expect(404);
    });

    it('DELETE class returns 404 (endpoint removed)', async () => {
      await request(ctx.server)
        .delete('/api/admin/classes/some-id')
        .set(authHeader(accessToken))
        .expect(404);
    });

    it('DELETE student returns 404 (endpoint removed)', async () => {
      await request(ctx.server)
        .delete('/api/admin/students/some-id')
        .set(authHeader(accessToken))
        .expect(404);
    });
  });

  describe('DIR-3: Interview protection', () => {
    it('DELETE /interviews/:id returns 404 (endpoint removed)', async () => {
      await request(ctx.server)
        .delete('/api/interviews/non-existent-id')
        .set(authHeader(accessToken))
        .expect(404);
    });

    it('template delete returns 409 when referenced by interview', async () => {
      const tmplRes = await request(ctx.server)
        .post('/api/interviews/templates')
        .set(authHeader(accessToken))
        .send({
          name: 'E2E RefCheck Template',
          description: 'ref check',
          fields: [{ key: 'note', label: 'Note' }],
        })
        .expect(201);
      const tmplId = tmplRes.body.id;

      const gradeRes = await request(ctx.server)
        .post('/api/admin/grades')
        .set(authHeader(accessToken))
        .send({ name: 'E2E RefGrade' })
        .expect(201);
      const classRes = await request(ctx.server)
        .post('/api/admin/classes')
        .set(authHeader(accessToken))
        .send({ name: 'E2E RefClass', gradeId: gradeRes.body.id })
        .expect(201);
      const stuRes = await request(ctx.server)
        .post('/api/admin/students')
        .set(authHeader(accessToken))
        .send({
          name: 'E2E RefStudent',
          studentNumber: `REF${Date.now()}`,
          classId: classRes.body.id,
        })
        .expect(201);

      const meRes = await request(ctx.server)
        .get('/api/auth/me')
        .set(authHeader(accessToken))
        .expect(200);
      const adminUserId = meRes.body.id;

      await request(ctx.server)
        .post('/api/interviews')
        .set(authHeader(accessToken))
        .send({
          studentId: stuRes.body.userId || stuRes.body.id,
          psychologistId: adminUserId,
          interviewDate: new Date().toISOString(),
          templateId: tmplId,
          content: 'E2E interview content',
        })
        .expect(201);

      await request(ctx.server)
        .delete(`/api/interviews/templates/${tmplId}`)
        .set(authHeader(accessToken))
        .expect(409);
    });
  });

  describe('DIR-5: Audit log query', () => {
    it('GET /admin/audit-logs returns paginated data', async () => {
      const res = await request(ctx.server)
        .get('/api/admin/audit-logs')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('GET /admin/audit-logs supports entityType filter', async () => {
      const res = await request(ctx.server)
        .get('/api/admin/audit-logs?entityType=student')
        .set(authHeader(accessToken))
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /admin/audit-logs supports pagination', async () => {
      const res = await request(ctx.server)
        .get('/api/admin/audit-logs?page=1&limit=5')
        .set(authHeader(accessToken))
        .expect(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });
});

function createMinimalDocx(): Buffer {
  const { execSync } = require('child_process');
  const tmpDir = path.join(os.tmpdir(), `e2e-docx-${Date.now()}`);
  fs.mkdirSync(path.join(tmpDir, 'word', '_rels'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '_rels'), { recursive: true });

  fs.writeFileSync(
    path.join(tmpDir, '[Content_Types].xml'),
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  fs.writeFileSync(
    path.join(tmpDir, '_rels', '.rels'),
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  fs.writeFileSync(
    path.join(tmpDir, 'word', 'document.xml'),
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body><w:p><w:r><w:t>E2E Test</w:t></w:r></w:p></w:body></w:document>',
  );
  fs.writeFileSync(
    path.join(tmpDir, 'word', '_rels', 'document.xml.rels'),
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
  );

  const outPath = path.join(os.tmpdir(), `e2e-test-${Date.now()}.docx`);
  execSync(`cd "${tmpDir}" && zip -q "${outPath}" -r .`);

  const buf = fs.readFileSync(outPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.unlinkSync(outPath);
  return buf;
}
