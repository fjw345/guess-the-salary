import type { SubmissionRecord } from './types.js';

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

export interface WordStats {
  word: string;
  count: number;
}

export interface DatasetStats {
  totalSubmissions: number;
  salariesWithAnnualEstimate: number;
  medianAnnualSalary: number | null;
  topCities: RankedCount[];
  degreeSalaries: DegreeSalaryStats[];
  topSchools: SchoolSalaryStats[];
  topWords: WordStats[];
  topMajors: RankedCount[];
  topPositions: RankedCount[];
}

type StatsSubmission = Pick<
  SubmissionRecord,
  | 'status'
  | 'degree'
  | 'schoolNameRaw'
  | 'hideSchool'
  | 'major'
  | 'city'
  | 'position'
  | 'roughAnnual'
  | 'salaryRaw'
  | 'authorNote'
>;

const degrees = ['本科', '硕士', '博士'] as const;
const ignoredLabels = new Set(['', '未知', '不详', '无', '暂无']);
const stopWords = new Set([
  '一个',
  '一些',
  '不是',
  '不要',
  '不能',
  '不会',
  '什么',
  '但是',
  '然后',
  '因为',
  '所以',
  '如果',
  '还是',
  '可以',
  '可能',
  '已经',
  '应该',
  '感觉',
  '觉得',
  '就是',
  '比较',
  '没有',
  '自己',
  '这个',
  '那个',
  '真的',
  '的话',
  '建议',
]);

function isUsefulLabel(value: string) {
  return !ignoredLabels.has(value.trim());
}

function annualEstimate(submission: Pick<StatsSubmission, 'roughAnnual' | 'salaryRaw'>) {
  if (submission.roughAnnual === null || submission.roughAnnual <= 0) return null;
  // Several seed rows use shorthand such as "税前年30" for 30 万元/年.
  if (
    submission.roughAnnual < 10_000 &&
    /年薪|年度|每年|\/年|税前年|税后年|年\d/.test(submission.salaryRaw)
  ) {
    return submission.roughAnnual * 10_000;
  }
  return submission.roughAnnual;
}

function rankLabels(values: string[], limit: number): RankedCount[] {
  const counts = new Map<string, number>();
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!isUsefulLabel(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort(
      (left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'),
    )
    .slice(0, limit);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function tokenizeNotes(notes: string[]): WordStats[] {
  const counts = new Map<string, number>();
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

  for (const note of notes) {
    for (const segment of segmenter.segment(note.toLowerCase())) {
      const word = segment.segment.trim();
      if (
        !segment.isWordLike ||
        Array.from(word).length < 2 ||
        stopWords.has(word) ||
        /^\d+(?:\.\d+)?$/.test(word)
      ) {
        continue;
      }
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word, 'zh-CN'))
    .slice(0, 12);
}

export function summarizeDatasetStats(submissions: StatsSubmission[]): DatasetStats {
  const approved = submissions.filter((submission) => submission.status === 'APPROVED');
  const annualSalaries = approved.flatMap((submission) =>
    annualEstimate(submission) !== null ? [annualEstimate(submission)!] : [],
  );

  const degreeSalaries = degrees.map((degree) => {
    const salaries = approved.flatMap((submission) =>
      submission.degree === degree && annualEstimate(submission) !== null
        ? [annualEstimate(submission)!]
        : [],
    );
    return {
      degree,
      count: salaries.length,
      average: salaries.length
        ? Math.round(salaries.reduce((total, salary) => total + salary, 0) / salaries.length)
        : null,
      minimum: salaries.length ? Math.min(...salaries) : null,
      maximum: salaries.length ? Math.max(...salaries) : null,
    };
  });

  const schoolSalaries = new Map<string, { count: number; total: number }>();
  for (const submission of approved) {
    if (
      submission.hideSchool ||
      !isUsefulLabel(submission.schoolNameRaw) ||
      annualEstimate(submission) === null
    ) {
      continue;
    }
    const current = schoolSalaries.get(submission.schoolNameRaw) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += annualEstimate(submission)!;
    schoolSalaries.set(submission.schoolNameRaw, current);
  }

  const topSchools = [...schoolSalaries.entries()]
    .map(([school, values]) => ({
      school,
      count: values.count,
      average: Math.round(values.total / values.count),
    }))
    .sort(
      (left, right) =>
        right.average - left.average ||
        right.count - left.count ||
        left.school.localeCompare(right.school, 'zh-CN'),
    )
    .slice(0, 6);

  return {
    totalSubmissions: approved.length,
    salariesWithAnnualEstimate: annualSalaries.length,
    medianAnnualSalary: median(annualSalaries),
    topCities: rankLabels(
      approved.map((submission) => submission.city),
      8,
    ),
    degreeSalaries,
    topSchools,
    topWords: tokenizeNotes(
      approved.flatMap((submission) => (submission.authorNote ? [submission.authorNote] : [])),
    ),
    topMajors: rankLabels(
      approved.map((submission) => submission.major),
      8,
    ),
    topPositions: rankLabels(
      approved.map((submission) => submission.position),
      8,
    ),
  };
}
