import type { ParsedSalary, SalaryBasis, SalaryPeriod } from '@guess-salary/shared';

export type Degree = '专科' | '本科' | '硕士' | '博士';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SchoolRecord {
  id: number;
  name: string;
  aliases: string[];
  tags: string[];
}

export type MajorDegreeType = 'BACHELOR' | 'MASTER' | 'DOCTOR';

export interface MajorRecord {
  id: string;
  name: string;
  category: string;
  degreeTypes: MajorDegreeType[];
  code?: string;
  aliases: string[];
}

export type CityLevel = 'MUNICIPALITY' | 'PREFECTURE' | 'COUNTY' | 'SPECIAL';

export interface CityRecord {
  id: string;
  name: string;
  province: string;
  level: CityLevel;
  aliases: string[];
}

export interface SubmissionRecord {
  id: string;
  degree: Degree;
  schoolId: number | null;
  schoolNameRaw: string;
  hideSchool: boolean;
  major: string;
  tenureText: string;
  tenureMonths: number | null;
  city: string;
  companyName: string;
  hideCompany: boolean;
  position: string;
  salaryRaw: string;
  salaryAmount: number | null;
  salaryPeriod: SalaryPeriod;
  salaryBasis: SalaryBasis;
  salaryIsIntern: boolean;
  salaryHasPlus: boolean;
  roughAnnual: number | null;
  authorNote: string | null;
  status: ReviewStatus;
  rejectReason: string | null;
  sourceType: 'SEED' | 'SURVEY' | 'SELF_REPORT';
  submittedAt: string;
  reviewedAt: string | null;
  ipHash: string | null;
  sourceRow: number | null;
  school: SchoolRecord | null;
}

export interface RoundRecord {
  id: string;
  sessionId: string;
  submissionId: string;
  guessAmount: number | null;
  guessPeriod: SalaryPeriod | null;
  servedAt: string;
  answeredAt: string | null;
}

export interface SeedRow {
  sourceRow: number;
  degree: Degree;
  schoolNameRaw: string;
  major: string;
  tenureText: string;
  city: string;
  companyName: string;
  position: string;
  salaryRaw: string;
  authorNote: string;
}

export interface AnswerResult {
  round: RoundRecord;
  submission: SubmissionRecord;
  parsed: ParsedSalary;
}

export interface ReportRecord {
  id: string;
  roundId: string | null;
  reason: 'IDENTITY_LEAK' | 'FALSE_INFO' | 'OFFENSIVE' | 'OTHER';
  details: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
}
