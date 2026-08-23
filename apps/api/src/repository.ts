import { randomUUID } from 'node:crypto';
import {
  parseSalary,
  parseTenure,
  scoreGuess,
  summarizeGuessScores,
  type ParsedSalary,
  type ReportInput,
  type SalaryBasis,
  type SalaryPeriod,
  type SubmissionInput,
} from '@guess-salary/shared';
import { buildSeedSubmissions } from './seed.js';
import { summarizeDatasetStats, type DatasetStats } from './dataset-stats.js';
import { findSchool, knownSchools, searchSchools } from './schools.js';
import type {
  AnswerResult,
  ReportRecord,
  ReviewStatus,
  RoundRecord,
  SchoolRecord,
  SubmissionRecord,
} from './types.js';

export interface CreateSubmissionInput extends SubmissionInput {
  salaryRaw: string;
  roughAnnual: number;
  ipHash: string;
}

export function parsedSalaryForSubmission(
  submission: Pick<
    SubmissionRecord,
    | 'salaryRaw'
    | 'salaryAmount'
    | 'salaryPeriod'
    | 'salaryBasis'
    | 'salaryIsIntern'
    | 'salaryHasPlus'
    | 'roughAnnual'
  >,
): ParsedSalary {
  const parsed = parseSalary(submission.salaryRaw);
  return {
    ...parsed,
    amount: submission.salaryAmount ?? parsed.amount,
    period: submission.salaryPeriod,
    basis: submission.salaryBasis,
    isIntern: submission.salaryIsIntern,
    hasPlus: submission.salaryHasPlus,
    roughAnnual: submission.roughAnnual,
    comparisonLabel: parsed.amountRange
      ? '原文的薪资区间'
      : submission.salaryAmount === null
        ? null
        : submission.salaryPeriod === 'MONTHLY'
          ? '原文的月薪部分'
          : submission.salaryPeriod === 'ANNUAL'
            ? '原文的年薪部分'
            : '原文主金额',
  };
}

export interface Repository {
  initialize(): Promise<void>;
  close?(): Promise<void>;
  health(): Promise<{ storage: string; submissions: number }>;
  findSchools(query: string, limit?: number): Promise<SchoolRecord[]>;
  nextRound(
    sessionId: string,
  ): Promise<{ round: RoundRecord; submission: SubmissionRecord } | null>;
  answerRound(
    roundId: string,
    guessAmount: number,
    guessPeriod: SalaryPeriod,
  ): Promise<AnswerResult | 'NOT_FOUND' | 'ANSWERED' | 'PERIOD_MISMATCH'>;
  stats(sessionId: string): Promise<{
    answeredCount: number;
    medianDeviation: number | null;
    hitRate: number | null;
  }>;
  publicStats(): Promise<DatasetStats>;
  createSubmission(input: CreateSubmissionInput): Promise<SubmissionRecord>;
  pendingSubmissions(): Promise<SubmissionRecord[]>;
  reviewSubmission(
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
  ): Promise<SubmissionRecord | null>;
  duplicateCandidates(submission: SubmissionRecord): Promise<SubmissionRecord[]>;
  createReport(input: ReportInput, ipHash: string): Promise<ReportRecord>;
  openReports(): Promise<ReportRecord[]>;
  resolveReport(id: string): Promise<ReportRecord | null>;
  createCaptchaChallenge(token: string, answer: number, expiresAt: Date): Promise<void>;
  consumeCaptchaChallenge(token: string): Promise<{ answer: number; expiresAt: Date } | null>;
}

export class MemoryRepository implements Repository {
  private submissions: SubmissionRecord[] = [];
  private rounds: RoundRecord[] = [];
  private schools: SchoolRecord[] = structuredClone(knownSchools);
  private reports: ReportRecord[] = [];
  private captchaChallenges = new Map<string, { answer: number; expiresAt: Date }>();

  async initialize() {
    this.submissions = await buildSeedSubmissions();
    this.captchaChallenges.clear();
  }

  async health() {
    return { storage: 'memory', submissions: this.submissions.length };
  }

  async findSchools(query: string, limit = 8) {
    return searchSchools(query, this.schools, limit);
  }

  async nextRound(sessionId: string) {
    const approved = this.submissions.filter((submission) => submission.status === 'APPROVED');
    if (!approved.length) return null;
    const servedIds = new Set(
      this.rounds
        .filter((round) => round.sessionId === sessionId)
        .map((round) => round.submissionId),
    );
    let candidates = approved.filter((submission) => !servedIds.has(submission.id));
    if (!candidates.length) candidates = approved;

    const lastRound = this.rounds.filter((round) => round.sessionId === sessionId).at(-1);
    const lastSubmission = lastRound
      ? this.submissions.find((submission) => submission.id === lastRound.submissionId)
      : null;
    const bucket = (value: number | null) =>
      value === null ? 'unknown' : value < 200_000 ? 'low' : value < 500_000 ? 'mid' : 'high';
    if (lastSubmission && candidates.length > 2) {
      const otherBucket = candidates.filter(
        (candidate) => bucket(candidate.roughAnnual) !== bucket(lastSubmission.roughAnnual),
      );
      if (otherBucket.length) candidates = otherBucket;
    }

    const submission = candidates[Math.floor(Math.random() * candidates.length)]!;
    const round: RoundRecord = {
      id: randomUUID(),
      sessionId,
      submissionId: submission.id,
      guessAmount: null,
      guessPeriod: null,
      servedAt: new Date().toISOString(),
      answeredAt: null,
    };
    this.rounds.push(round);
    return { round, submission };
  }

  async answerRound(
    roundId: string,
    guessAmount: number,
    guessPeriod: SalaryPeriod,
  ): Promise<AnswerResult | 'NOT_FOUND' | 'ANSWERED' | 'PERIOD_MISMATCH'> {
    const round = this.rounds.find((item) => item.id === roundId);
    if (!round) return 'NOT_FOUND';
    if (round.answeredAt) return 'ANSWERED';
    const submission = this.submissions.find((item) => item.id === round.submissionId)!;
    if (submission.salaryPeriod !== 'UNKNOWN' && guessPeriod !== submission.salaryPeriod) {
      return 'PERIOD_MISMATCH';
    }
    round.guessAmount = guessAmount;
    round.guessPeriod = guessPeriod;
    round.answeredAt = new Date().toISOString();
    return {
      round,
      submission,
      parsed: parsedSalaryForSubmission(submission),
    };
  }

  async stats(sessionId: string) {
    const answered = this.rounds.filter(
      (round) => round.sessionId === sessionId && round.answeredAt,
    );
    const scores = answered.flatMap((round) => {
      const submission = this.submissions.find((item) => item.id === round.submissionId);
      if (!submission || round.guessAmount === null) return [];
      const score = scoreGuess(round.guessAmount, parsedSalaryForSubmission(submission));
      return score ? [score] : [];
    });
    return {
      answeredCount: answered.length,
      ...summarizeGuessScores(scores),
    };
  }

  async publicStats() {
    return summarizeDatasetStats(this.submissions);
  }

  async createSubmission(input: CreateSubmissionInput) {
    const school = findSchool(input.schoolNameRaw, this.schools);
    const record: SubmissionRecord = {
      id: randomUUID(),
      degree: input.degree,
      schoolId: school?.id ?? null,
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
      rejectReason: null,
      sourceType: 'SELF_REPORT',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      ipHash: input.ipHash,
      sourceRow: null,
      school,
    };
    this.submissions.unshift(record);
    return record;
  }

  async pendingSubmissions() {
    return this.submissions.filter((submission) => submission.status === 'PENDING');
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
    const submission = this.submissions.find((item) => item.id === id);
    if (!submission) return null;
    submission.status = status;
    submission.rejectReason =
      status === 'REJECTED' ? (changes.rejectReason ?? '不符合收录要求') : null;
    submission.reviewedAt = new Date().toISOString();
    if (changes.authorNote !== undefined) submission.authorNote = changes.authorNote;
    if (changes.schoolId !== undefined) {
      submission.schoolId = changes.schoolId;
      submission.school = this.schools.find((school) => school.id === changes.schoolId) ?? null;
    }
    if (changes.salaryPeriod) submission.salaryPeriod = changes.salaryPeriod;
    if (changes.salaryBasis) submission.salaryBasis = changes.salaryBasis;
    if (changes.hideSchool !== undefined) submission.hideSchool = changes.hideSchool;
    if (changes.hideCompany !== undefined) submission.hideCompany = changes.hideCompany;
    submission.roughAnnual = submission.salaryAmount
      ? submission.salaryPeriod === 'MONTHLY'
        ? submission.salaryAmount * 12
        : submission.salaryPeriod === 'ANNUAL'
          ? submission.salaryAmount
          : null
      : null;
    return submission;
  }

  async duplicateCandidates(submission: SubmissionRecord) {
    return this.submissions.filter(
      (candidate) =>
        candidate.id !== submission.id &&
        candidate.schoolNameRaw === submission.schoolNameRaw &&
        candidate.city === submission.city &&
        candidate.companyName === submission.companyName &&
        candidate.position === submission.position,
    );
  }

  async createReport(input: ReportInput, _ipHash: string) {
    const report: ReportRecord = {
      id: randomUUID(),
      roundId: input.roundId ?? null,
      reason: input.reason,
      details: input.details,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    this.reports.unshift(report);
    return report;
  }

  async openReports() {
    return this.reports.filter((report) => report.status === 'OPEN');
  }

  async resolveReport(id: string) {
    const report = this.reports.find((item) => item.id === id);
    if (!report) return null;
    report.status = 'RESOLVED';
    report.resolvedAt = new Date().toISOString();
    return report;
  }

  async createCaptchaChallenge(token: string, answer: number, expiresAt: Date) {
    this.captchaChallenges.set(token, { answer, expiresAt });
  }

  async consumeCaptchaChallenge(token: string) {
    const challenge = this.captchaChallenges.get(token);
    this.captchaChallenges.delete(token);
    if (!challenge || challenge.expiresAt.getTime() < Date.now()) return null;
    return challenge;
  }
}
