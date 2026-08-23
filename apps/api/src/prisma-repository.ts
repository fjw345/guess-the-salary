import {
  PrismaClient,
  type Submission as PrismaSubmission,
  type School as PrismaSchool,
} from '@prisma/client';
import {
  scoreGuess,
  summarizeGuessScores,
  parseTenure,
  type ReportInput,
  type SalaryBasis,
  type SalaryPeriod,
} from '@guess-salary/shared';
import {
  parsedSalaryForSubmission,
  type CreateSubmissionInput,
  type Repository,
} from './repository.js';
import { searchSchools } from './schools.js';
import type {
  AnswerResult,
  Degree,
  ReportRecord,
  ReviewStatus,
  RoundRecord,
  SchoolRecord,
  SubmissionRecord,
} from './types.js';
import { summarizeDatasetStats } from './dataset-stats.js';

const degreeToPrisma = {
  专科: 'COLLEGE',
  本科: 'BACHELOR',
  硕士: 'MASTER',
  博士: 'DOCTOR',
} as const;
const degreeFromPrisma = {
  COLLEGE: '专科',
  BACHELOR: '本科',
  MASTER: '硕士',
  DOCTOR: '博士',
} as const;

type SubmissionWithSchool = PrismaSubmission & { school: PrismaSchool | null };

function schoolRecord(school: PrismaSchool | null): SchoolRecord | null {
  return school
    ? { id: school.id, name: school.name, aliases: school.aliases, tags: school.tags }
    : null;
}

function submissionRecord(item: SubmissionWithSchool): SubmissionRecord {
  return {
    id: item.id,
    degree: degreeFromPrisma[item.degree] as Degree,
    schoolId: item.schoolId,
    schoolNameRaw: item.schoolNameRaw,
    hideSchool: item.hideSchool,
    major: item.major,
    tenureText: item.tenureText,
    tenureMonths: item.tenureMonths,
    city: item.city,
    companyName: item.companyName,
    hideCompany: item.hideCompany,
    position: item.position,
    salaryRaw: item.salaryRaw,
    salaryAmount: item.salaryAmount,
    salaryPeriod: item.salaryPeriod,
    salaryBasis: item.salaryBasis,
    salaryIsIntern: item.salaryIsIntern,
    salaryHasPlus: item.salaryHasPlus,
    roughAnnual: item.roughAnnual,
    authorNote: item.authorNote,
    status: item.status,
    rejectReason: item.rejectReason,
    sourceType: item.sourceType,
    submittedAt: item.submittedAt.toISOString(),
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    ipHash: item.ipHash,
    sourceRow: item.sourceRow,
    school: schoolRecord(item.school),
  };
}

function roundRecord(item: {
  id: string;
  sessionId: string;
  submissionId: string;
  guessAmount: number | null;
  guessPeriod: SalaryPeriod | null;
  servedAt: Date;
  answeredAt: Date | null;
}): RoundRecord {
  return {
    id: item.id,
    sessionId: item.sessionId,
    submissionId: item.submissionId,
    guessAmount: item.guessAmount,
    guessPeriod: item.guessPeriod,
    servedAt: item.servedAt.toISOString(),
    answeredAt: item.answeredAt?.toISOString() ?? null,
  };
}

function reportRecord(item: {
  id: string;
  roundId: string | null;
  reason: ReportRecord['reason'];
  details: string;
  status: ReportRecord['status'];
  createdAt: Date;
  resolvedAt: Date | null;
}): ReportRecord {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    resolvedAt: item.resolvedAt?.toISOString() ?? null,
  };
}

export class PrismaRepository implements Repository {
  private prisma = new PrismaClient();

  async initialize() {
    await this.prisma.$connect();
  }

  async close() {
    await this.prisma.$disconnect();
  }

  async health() {
    return { storage: 'postgresql', submissions: await this.prisma.submission.count() };
  }

  async findSchools(query: string, limit = 8) {
    const term = query.trim();
    const schools = await this.prisma.school.findMany({
      where: term
        ? {
            OR: [{ name: { contains: term, mode: 'insensitive' } }, { aliases: { has: term } }],
          }
        : undefined,
      orderBy: { name: 'asc' },
      take: term ? Math.max(limit * 5, 40) : limit,
    });
    return searchSchools(
      query,
      schools.map((school) => schoolRecord(school)!),
      limit,
    );
  }

  async nextRound(sessionId: string) {
    const served = await this.prisma.gameRound.findMany({
      where: { sessionId },
      select: { submissionId: true },
    });
    const where = {
      status: 'APPROVED' as const,
      ...(served.length ? { id: { notIn: served.map((item) => item.submissionId) } } : {}),
    };
    let candidates = await this.prisma.submission.findMany({ where, include: { school: true } });
    if (!candidates.length)
      candidates = await this.prisma.submission.findMany({
        where: { status: 'APPROVED' },
        include: { school: true },
      });
    if (!candidates.length) return null;

    const latest = await this.prisma.gameRound.findFirst({
      where: { sessionId },
      orderBy: { servedAt: 'desc' },
      include: { submission: true },
    });
    const bucket = (value: number | null) =>
      value === null ? 'unknown' : value < 200_000 ? 'low' : value < 500_000 ? 'mid' : 'high';
    if (latest && candidates.length > 2) {
      const varied = candidates.filter(
        (candidate) => bucket(candidate.roughAnnual) !== bucket(latest.submission.roughAnnual),
      );
      if (varied.length) candidates = varied;
    }
    const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
    const round = await this.prisma.gameRound.create({
      data: { sessionId, submissionId: selected.id },
    });
    return { round: roundRecord(round), submission: submissionRecord(selected) };
  }

  async answerRound(
    roundId: string,
    guessAmount: number,
    guessPeriod: SalaryPeriod,
  ): Promise<AnswerResult | 'NOT_FOUND' | 'ANSWERED' | 'PERIOD_MISMATCH'> {
    const existing = await this.prisma.gameRound.findUnique({
      where: { id: roundId },
      include: { submission: { include: { school: true } } },
    });
    if (!existing) return 'NOT_FOUND';
    if (existing.answeredAt) return 'ANSWERED';
    if (
      existing.submission.salaryPeriod !== 'UNKNOWN' &&
      guessPeriod !== existing.submission.salaryPeriod
    ) {
      return 'PERIOD_MISMATCH';
    }
    const updated = await this.prisma.gameRound.updateMany({
      where: { id: roundId, answeredAt: null },
      data: { guessAmount, guessPeriod, answeredAt: new Date() },
    });
    if (!updated.count) return 'ANSWERED';
    const round = await this.prisma.gameRound.findUniqueOrThrow({ where: { id: roundId } });
    const submission = submissionRecord(existing.submission);
    return {
      round: roundRecord(round),
      submission,
      parsed: parsedSalaryForSubmission(submission),
    };
  }

  async stats(sessionId: string) {
    const answered = await this.prisma.gameRound.findMany({
      where: { sessionId, answeredAt: { not: null } },
      include: { submission: true },
    });
    const scores = answered.flatMap((round) => {
      if (round.guessAmount === null) return [];
      const submission = submissionRecord({ ...round.submission, school: null });
      const score = scoreGuess(round.guessAmount, parsedSalaryForSubmission(submission));
      return score ? [score] : [];
    });
    return {
      answeredCount: answered.length,
      ...summarizeGuessScores(scores),
    };
  }

  async publicStats() {
    const submissions = await this.prisma.submission.findMany({
      where: { status: 'APPROVED' },
      include: { school: true },
    });
    return summarizeDatasetStats(submissions.map(submissionRecord));
  }

  async createSubmission(input: CreateSubmissionInput) {
    const school = await this.prisma.school.findFirst({
      where: { OR: [{ name: input.schoolNameRaw }, { aliases: { has: input.schoolNameRaw } }] },
    });
    const created = await this.prisma.submission.create({
      data: {
        degree: degreeToPrisma[input.degree],
        schoolId: school?.id,
        schoolNameRaw: input.schoolNameRaw,
        hideSchool: false,
        major: input.major,
        tenureText: input.tenureText,
        tenureMonths: parseTenure(input.tenureText),
        city: input.city,
        companyName: input.companyName,
        hideCompany: false,
        position: input.position,
        salaryRaw: input.salaryRaw,
        salaryAmount: input.salaryAmount,
        salaryPeriod: input.salaryPeriod,
        salaryBasis: input.salaryBasis,
        salaryIsIntern: input.salaryIsIntern,
        salaryHasPlus: false,
        roughAnnual: input.roughAnnual,
        authorNote: input.authorNote,
        status: 'PENDING',
        sourceType: 'SELF_REPORT',
        ipHash: input.ipHash,
      },
      include: { school: true },
    });
    return submissionRecord(created);
  }

  async pendingSubmissions() {
    return (
      await this.prisma.submission.findMany({
        where: { status: 'PENDING' },
        include: { school: true },
        orderBy: { submittedAt: 'asc' },
      })
    ).map(submissionRecord);
  }

  async reviewSubmission(
    id: string,
    status: ReviewStatus,
    changes: {
      rejectReason?: string;
      authorNote?: string;
      schoolId?: number | null;
      salaryPeriod?: SalaryPeriod;
      salaryBasis?: SalaryBasis;
      hideSchool?: boolean;
      hideCompany?: boolean;
    },
  ) {
    const current = await this.prisma.submission.findUnique({ where: { id } });
    if (!current) return null;
    const period = changes.salaryPeriod ?? current.salaryPeriod;
    const roughAnnual = current.salaryAmount
      ? period === 'MONTHLY'
        ? current.salaryAmount * 12
        : period === 'ANNUAL'
          ? current.salaryAmount
          : null
      : null;
    const updated = await this.prisma.submission.update({
      where: { id },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? (changes.rejectReason ?? '不符合收录要求') : null,
        reviewedAt: new Date(),
        authorNote: changes.authorNote,
        schoolId: changes.schoolId,
        salaryPeriod: changes.salaryPeriod,
        salaryBasis: changes.salaryBasis,
        hideSchool: changes.hideSchool,
        hideCompany: changes.hideCompany,
        roughAnnual,
      },
      include: { school: true },
    });
    return submissionRecord(updated);
  }

  async duplicateCandidates(submission: SubmissionRecord) {
    return (
      await this.prisma.submission.findMany({
        where: {
          id: { not: submission.id },
          schoolNameRaw: submission.schoolNameRaw,
          city: submission.city,
          companyName: submission.companyName,
          position: submission.position,
        },
        include: { school: true },
      })
    ).map(submissionRecord);
  }

  async createReport(input: ReportInput, ipHash: string) {
    return reportRecord(
      await this.prisma.contentReport.create({
        data: { roundId: input.roundId, reason: input.reason, details: input.details, ipHash },
      }),
    );
  }

  async openReports() {
    return (
      await this.prisma.contentReport.findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
      })
    ).map(reportRecord);
  }

  async resolveReport(id: string) {
    const exists = await this.prisma.contentReport.findUnique({ where: { id } });
    if (!exists) return null;
    return reportRecord(
      await this.prisma.contentReport.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      }),
    );
  }

  async createCaptchaChallenge(token: string, answer: number, expiresAt: Date) {
    await this.prisma.captchaChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await this.prisma.captchaChallenge.create({ data: { token, answer, expiresAt } });
  }

  async consumeCaptchaChallenge(token: string) {
    const rows = await this.prisma.$queryRaw<Array<{ answer: number; expiresAt: Date }>>`
      DELETE FROM "CaptchaChallenge"
      WHERE "token" = ${token}
      RETURNING "answer", "expiresAt"
    `;
    const challenge = rows[0];
    if (!challenge || challenge.expiresAt.getTime() < Date.now()) return null;
    return challenge;
  }
}
