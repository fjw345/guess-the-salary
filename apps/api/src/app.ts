import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  answerSchema,
  describeGuessDiff,
  primarySchoolTags,
  reportSchema,
  reviewSchema,
  salaryPrompt,
  submissionSchema,
} from '@guess-salary/shared';
import bcrypt from 'bcryptjs';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MemoryRepository } from './repository.js';
import type { Repository } from './repository.js';
import { searchCities } from './cities.js';
import { searchMajors } from './majors.js';

interface AppOptions {
  logger?: boolean;
  adminPasswordHash?: string;
  adminSessionSecret?: string;
  corsOrigins?: string[];
  ipHashSalt?: string;
  storage?: 'memory' | 'database';
  trustProxy?: boolean;
}

const adminTokenTtlMs = 12 * 60 * 60 * 1_000;

function signAdminPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function issueAdminToken(secret: string) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + adminTokenTtlMs, nonce: randomUUID() }),
  ).toString('base64url');
  return `${payload}.${signAdminPayload(payload, secret)}`;
}

function verifyAdminToken(token: string, secret: string) {
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    const expected = signAdminPayload(payload, secret);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return false;
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export async function buildApp(options: AppOptions = {}) {
  const databaseMode =
    options.storage === 'database' ||
    (options.storage !== 'memory' && Boolean(process.env.DATABASE_URL));
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: options.trustProxy ?? process.env.TRUST_PROXY === 'true',
  });
  let repository: Repository;
  if (databaseMode) {
    const { PrismaRepository } = await import('./prisma-repository.js');
    repository = new PrismaRepository();
  } else {
    repository = new MemoryRepository();
  }
  await repository.initialize();
  app.addHook('onClose', async () => repository.close?.());
  const adminPasswordHash = options.adminPasswordHash ?? process.env.ADMIN_PASSWORD_HASH ?? '';
  const configuredAdminSessionSecret =
    options.adminSessionSecret ?? process.env.ADMIN_SESSION_SECRET ?? '';
  const adminSessionSecret =
    configuredAdminSessionSecret || (databaseMode ? '' : adminPasswordHash || 'local-development');
  const ipHashSalt = options.ipHashSalt ?? process.env.IP_HASH_SALT ?? 'local-development-only';
  if (
    databaseMode &&
    (!adminPasswordHash ||
      !ipHashSalt ||
      ipHashSalt === 'local-development-only' ||
      !adminSessionSecret ||
      adminSessionSecret.length < 32)
  ) {
    throw new Error(
      '数据库模式必须配置 ADMIN_PASSWORD_HASH、ADMIN_SESSION_SECRET（至少 32 个字符）和 IP_HASH_SALT。',
    );
  }

  const corsOrigins =
    options.corsOrigins ??
    (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  await app.register(cors, { origin: corsOrigins.length ? corsOrigins : true });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  const health = async () => ({ ok: true, ...(await repository.health()) });
  app.get('/health', health);
  app.get('/api/health', health);

  app.get('/api/schools', async (request) => {
    const { query, limit } = z
      .object({
        query: z.string().default(''),
        limit: z.coerce.number().int().min(1).max(4_000).default(8),
      })
      .parse(request.query);
    return { items: await repository.findSchools(query, limit) };
  });

  app.get('/api/majors', async (request) => {
    const { query, degree, limit } = z
      .object({
        query: z.string().default(''),
        degree: z.enum(['专科', '本科', '硕士', '博士']).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(8),
      })
      .parse(request.query);
    return { items: searchMajors(query, degree, undefined, limit) };
  });

  app.get('/api/cities', async (request) => {
    const { query, limit } = z
      .object({
        query: z.string().default(''),
        limit: z.coerce.number().int().min(1).max(100).default(8),
      })
      .parse(request.query);
    return { items: searchCities(query, undefined, limit) };
  });

  app.get('/api/rounds/next', async (request, reply) => {
    const { sessionId } = z
      .object({ sessionId: z.string().trim().min(8).max(120) })
      .parse(request.query);
    const next = await repository.nextRound(sessionId);
    if (!next)
      return reply
        .code(404)
        .send({ code: 'EMPTY_LIBRARY', message: '题库正在补充中，请稍后再来。' });
    const { round, submission } = next;
    return {
      id: round.id,
      prompt: salaryPrompt(
        submission.salaryPeriod,
        submission.salaryBasis,
        submission.salaryIsIntern,
      ),
      salaryPeriod: submission.salaryPeriod,
      salaryBasis: submission.salaryBasis,
      salaryIsIntern: submission.salaryIsIntern,
      profile: {
        degree: submission.degree,
        schoolName: submission.hideSchool ? null : submission.schoolNameRaw,
        schoolHidden: submission.hideSchool,
        schoolTags: primarySchoolTags(submission.school?.tags ?? []),
        major: submission.major,
        tenureText: submission.tenureText,
        city: submission.city,
        companyName: submission.hideCompany ? '公司信息已隐藏' : submission.companyName,
        companyHidden: submission.hideCompany,
        position: submission.position,
      },
    };
  });

  app.post('/api/rounds/:id/answer', async (request, reply) => {
    const { id } = z.object({ id: z.string().trim().min(1).max(100) }).parse(request.params);
    const input = answerSchema.parse(request.body);
    const result = await repository.answerRound(id, input.guessAmount, input.guessPeriod);
    if (result === 'NOT_FOUND')
      return reply.code(404).send({ code: 'ROUND_NOT_FOUND', message: '这道题已失效，请换一题。' });
    if (result === 'ANSWERED')
      return reply.code(409).send({ code: 'ROUND_ANSWERED', message: '这道题已经回答过了。' });
    if (result === 'PERIOD_MISMATCH')
      return reply
        .code(422)
        .send({ code: 'PERIOD_MISMATCH', message: '猜测周期与本题口径不一致，请按题目口径作答。' });
    const diff = describeGuessDiff(input.guessAmount, result.parsed);
    return {
      guess: { amount: input.guessAmount, period: input.guessPeriod },
      salaryRaw: result.submission.salaryRaw,
      parsed: result.parsed,
      diff,
      authorNote: result.submission.authorNote,
    };
  });

  app.get('/api/stats/:sessionId', async (request) => {
    const { sessionId } = z.object({ sessionId: z.string().min(8).max(120) }).parse(request.params);
    return repository.stats(sessionId);
  });

  app.get('/api/public-stats', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return repository.publicStats();
  });

  app.get('/api/captcha', async () => {
    const left = randomInt(2, 10);
    const right = randomInt(1, 10);
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await repository.createCaptchaChallenge(token, left + right, expiresAt);
    return { token, question: `${left} + ${right} = ?` };
  });

  app.post(
    '/api/submissions',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const input = submissionSchema.parse(request.body);
      if (input.website) return reply.code(202).send({ ok: true });
      const challenge = await repository.consumeCaptchaChallenge(input.captchaToken);
      if (!challenge || challenge.answer !== input.captchaAnswer) {
        return reply
          .code(400)
          .send({ code: 'CAPTCHA_INVALID', message: '验证题答案不正确，请重试。' });
      }
      const minimum = input.salaryPeriod === 'MONTHLY' ? 1_000 : 12_000;
      const maximum = input.salaryPeriod === 'MONTHLY' ? 300_000 : 8_000_000;
      if (input.salaryAmount < minimum || input.salaryAmount > maximum) {
        return reply.code(422).send({
          code: 'SALARY_OUT_OF_RANGE',
          message: `金额需在 ${minimum.toLocaleString('zh-CN')} 至 ${maximum.toLocaleString('zh-CN')} 元之间。`,
        });
      }
      const basis = input.salaryBasis === 'PRETAX' ? '税前' : '税后';
      const period = input.salaryPeriod === 'MONTHLY' ? '月薪' : '年薪';
      const salaryRaw = `${input.salaryIsIntern ? '实习期' : ''}${basis}${period}${input.salaryAmount.toLocaleString('zh-CN')}元`;
      const ipHash = createHash('sha256').update(`${ipHashSalt}:${request.ip}`).digest('hex');
      const record = await repository.createSubmission({
        ...input,
        salaryRaw,
        roughAnnual:
          input.salaryPeriod === 'MONTHLY' ? input.salaryAmount * 12 : input.salaryAmount,
        ipHash,
      });
      return reply.code(201).send({ id: record.id, status: record.status });
    },
  );

  app.post(
    '/api/reports',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const input = reportSchema.parse(request.body);
      if (input.website) return reply.code(202).send({ ok: true });
      const ipHash = createHash('sha256').update(`${ipHashSalt}:${request.ip}`).digest('hex');
      const report = await repository.createReport(input, ipHash);
      return reply.code(201).send({ id: report.id, status: report.status });
    },
  );

  app.post(
    '/api/admin/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const { password } = z.object({ password: z.string().min(1).max(200) }).parse(request.body);
      if (!adminPasswordHash || !(await bcrypt.compare(password, adminPasswordHash))) {
        return reply.code(401).send({ code: 'UNAUTHORIZED', message: '管理员凭据不正确。' });
      }
      return { token: issueAdminToken(adminSessionSecret) };
    },
  );

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token || !verifyAdminToken(token, adminSessionSecret)) {
      return reply.code(401).send({ code: 'UNAUTHORIZED', message: '请先登录管理员后台。' });
    }
  };

  app.get('/api/admin/submissions', { preHandler: requireAdmin }, async () => {
    const items = await repository.pendingSubmissions();
    return {
      items: await Promise.all(
        items.map(async (item) => ({
          ...item,
          ipHash: undefined,
          duplicates: (await repository.duplicateCandidates(item)).length,
        })),
      ),
    };
  });

  app.get('/api/admin/reports', { preHandler: requireAdmin }, async () => ({
    items: await repository.openReports(),
  }));

  app.patch('/api/admin/submissions/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const input = reviewSchema.parse(request.body);
    if (input.status === 'REJECTED' && !input.rejectReason) {
      return reply.code(422).send({ code: 'REASON_REQUIRED', message: '驳回时需要填写理由。' });
    }
    const record = await repository.reviewSubmission(id, input.status, input);
    if (!record) return reply.code(404).send({ code: 'NOT_FOUND', message: '投稿不存在。' });
    return { item: record };
  });

  app.patch('/api/admin/reports/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const report = await repository.resolveReport(id);
    if (!report) return reply.code(404).send({ code: 'NOT_FOUND', message: '举报不存在。' });
    return { item: report };
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: '提交内容不完整或格式不正确。',
        issues: error.issues,
      });
    }
    app.log.error(error);
    return reply
      .code(500)
      .send({ code: 'INTERNAL_ERROR', message: '服务暂时开小差，请稍后重试。' });
  });

  return app;
}
