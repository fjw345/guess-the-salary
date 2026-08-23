import type { GuessDiff, ParsedSalary, SalaryBasis, SalaryPeriod } from '@guess-salary/shared';

export interface RoundProfile {
  degree: string;
  schoolName: string | null;
  schoolHidden: boolean;
  schoolTags: string[];
  major: string;
  tenureText: string;
  city: string;
  companyName: string;
  companyHidden: boolean;
  position: string;
}

export interface Round {
  id: string;
  prompt: string;
  salaryPeriod: SalaryPeriod;
  salaryBasis: SalaryBasis;
  salaryIsIntern: boolean;
  profile: RoundProfile;
}

export interface RoundResult {
  guess: { amount: number; period: SalaryPeriod };
  salaryRaw: string;
  parsed: ParsedSalary;
  diff: GuessDiff | null;
  authorNote: string | null;
}

export interface Stats {
  answeredCount: number;
  medianDeviation: number | null;
  hitRate: number | null;
}

export interface RankedCount {
  label: string;
  count: number;
}

export interface DegreeSalaryStats {
  degree: '本科' | '硕士' | '博士';
  count: number;
  average: number | null;
  minimum: number | null;
  maximum: number | null;
}

export interface SchoolSalaryStats {
  school: string;
  count: number;
  average: number;
}

export interface DatasetStats {
  totalSubmissions: number;
  salariesWithAnnualEstimate: number;
  medianAnnualSalary: number | null;
  topCities: RankedCount[];
  degreeSalaries: DegreeSalaryStats[];
  topSchools: SchoolSalaryStats[];
  topWords: Array<{ word: string; count: number }>;
  topMajors: RankedCount[];
  topPositions: RankedCount[];
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
}
