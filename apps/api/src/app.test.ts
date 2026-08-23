import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('guess salary API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({
      adminPasswordHash: await bcrypt.hash('test-admin', 4),
      adminSessionSecret: 'test-admin-session-secret-with-more-than-32-chars',
      storage: 'memory',
    });
  });

  afterAll(async () => app.close());

  it('never leaks answer fields before answering', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rounds/next?sessionId=test-session-123',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.salaryRaw).toBeUndefined();
    expect(body.salaryAmount).toBeUndefined();
    expect(body.authorNote).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('想说的话');
    expect(body.profile.schoolName).toBeTruthy();
    expect(body.profile.companyName).not.toBe('公司信息已隐藏');
  });

  it('serves the tagged university catalog for selectors', async () => {
    const aliasSearch = await app.inject({ method: 'GET', url: '/api/schools?query=北大' });
    expect(aliasSearch.statusCode).toBe(200);
    expect(aliasSearch.json().items[0]).toMatchObject({
      name: '北京大学',
      tags: ['C9', '985', '211', '双一流', '本科', '北京'],
    });

    const fullCatalog = await app.inject({
      method: 'GET',
      url: '/api/schools?query=&limit=4000',
    });
    expect(fullCatalog.json().items).toHaveLength(3_309);
  });

  it('serves degree-aware major suggestions and normalized city suggestions', async () => {
    const majors = await app.inject({
      method: 'GET',
      url: '/api/majors?query=计算机&degree=本科',
    });
    expect(majors.statusCode).toBe(200);
    expect(majors.json().items[0]).toMatchObject({ name: '计算机科学与技术', category: '工学' });

    const cities = await app.inject({ method: 'GET', url: '/api/cities?query=上海市' });
    expect(cities.statusCode).toBe(200);
    expect(cities.json().items[0]).toMatchObject({ name: '上海', province: '上海市' });
  });

  it('supports next -> answer -> stats and rejects duplicate answers', async () => {
    const next = await app.inject({
      method: 'GET',
      url: '/api/rounds/next?sessionId=test-session-flow',
    });
    const round = next.json();
    const answer = await app.inject({
      method: 'POST',
      url: `/api/rounds/${round.id}/answer`,
      payload: { guessAmount: 20_000, guessPeriod: round.salaryPeriod },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toHaveProperty('salaryRaw');
    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/rounds/${round.id}/answer`,
      payload: { guessAmount: 20_000, guessPeriod: round.salaryPeriod },
    });
    expect(duplicate.statusCode).toBe(409);
    const stats = await app.inject({ method: 'GET', url: '/api/stats/test-session-flow' });
    expect(stats.json().answeredCount).toBe(1);
    expect(stats.json()).toHaveProperty('medianDeviation');
    expect(stats.json()).toHaveProperty('hitRate');
  });

  it('publishes aggregate dataset statistics without private fields', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/public-stats' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.json()).toMatchObject({
      totalSubmissions: 272,
      salariesWithAnnualEstimate: expect.any(Number),
      degreeSalaries: expect.arrayContaining([
        expect.objectContaining({ degree: '本科' }),
        expect.objectContaining({ degree: '硕士' }),
        expect.objectContaining({ degree: '博士' }),
      ]),
    });
    expect(JSON.stringify(response.json())).not.toContain('companyName');
    expect(JSON.stringify(response.json())).not.toContain('salaryRaw');
  });

  it('rejects answers submitted in a different salary period', async () => {
    let round: { id: string; salaryPeriod: 'MONTHLY' | 'ANNUAL' | 'UNKNOWN' } | undefined;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const next = await app.inject({
        method: 'GET',
        url: `/api/rounds/next?sessionId=period-check-${attempt}`,
      });
      const candidate = next.json();
      if (candidate.salaryPeriod !== 'UNKNOWN') {
        round = candidate;
        break;
      }
    }
    expect(round).toBeDefined();
    if (!round) return;
    const wrongPeriod = round.salaryPeriod === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY';
    const response = await app.inject({
      method: 'POST',
      url: `/api/rounds/${round.id}/answer`,
      payload: { guessAmount: 20_000, guessPeriod: wrongPeriod },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('PERIOD_MISMATCH');
  });

  it('submits and approves a contribution through admin review', async () => {
    const captcha = (await app.inject({ method: 'GET', url: '/api/captcha' })).json();
    const [left, right] = captcha.question.match(/\d+/g).map(Number);
    const submission = await app.inject({
      method: 'POST',
      url: '/api/submissions',
      payload: {
        degree: '本科',
        schoolNameRaw: '广东工业大学',
        major: '目录外的跨星系考古学',
        tenureText: '2年',
        city: '目录外的火星基地',
        companyName: '某消费品牌',
        position: '产品设计师',
        salaryAmount: 18_000,
        salaryPeriod: 'MONTHLY',
        salaryBasis: 'PRETAX',
        salaryIsIntern: false,
        authorNote: '作品集要讲清楚过程，而不是只放结果。',
        privacyConfirmed: true,
        captchaToken: captcha.token,
        captchaAnswer: left + right,
      },
    });
    expect(submission.statusCode).toBe(201);

    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { password: 'test-admin' },
    });
    const token = login.json().token;
    const pending = await app.inject({
      method: 'GET',
      url: '/api/admin/submissions',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pending.json().items).toHaveLength(1);
    expect(pending.json().items[0]).toMatchObject({
      major: '目录外的跨星系考古学',
      city: '目录外的火星基地',
    });
    const review = await app.inject({
      method: 'PATCH',
      url: `/api/admin/submissions/${submission.json().id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'APPROVED', hideSchool: true, hideCompany: true },
    });
    expect(review.json().item.status).toBe('APPROVED');
    expect(review.json().item.hideSchool).toBe(true);
    expect(review.json().item.hideCompany).toBe(true);
  });

  it('accepts a report and exposes it only in the admin queue', async () => {
    const report = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: { reason: 'FALSE_INFO', details: '这条薪资口径疑似填写错误。' },
    });
    expect(report.statusCode).toBe(201);
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { password: 'test-admin' },
    });
    const reports = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
      headers: { authorization: `Bearer ${login.json().token}` },
    });
    expect(reports.json().items).toHaveLength(1);
  });

  it('accepts signed admin tokens after the original app instance is recreated', async () => {
    const passwordHash = await bcrypt.hash('test-admin-recreated', 4);
    const secret = 'test-admin-session-secret-with-more-than-32-chars';
    const first = await buildApp({
      adminPasswordHash: passwordHash,
      adminSessionSecret: secret,
      storage: 'memory',
    });
    const login = await first.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { password: 'test-admin-recreated' },
    });
    const token = login.json().token;
    await first.close();

    const recreated = await buildApp({
      adminPasswordHash: passwordHash,
      adminSessionSecret: secret,
      storage: 'memory',
    });
    const response = await recreated.inject({
      method: 'GET',
      url: '/api/admin/reports',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    await recreated.close();
  });
});
