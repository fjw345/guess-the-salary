export const salaryPeriods = ['MONTHLY', 'ANNUAL', 'UNKNOWN'] as const;
export type SalaryPeriod = (typeof salaryPeriods)[number];

export const salaryBases = ['PRETAX', 'AFTERTAX', 'UNKNOWN'] as const;
export type SalaryBasis = (typeof salaryBases)[number];

export interface SalaryRange {
  min: number;
  max: number;
}

export interface ParsedSalary {
  amount: number | null;
  amountRange: SalaryRange | null;
  period: SalaryPeriod;
  basis: SalaryBasis;
  isIntern: boolean;
  hasPlus: boolean;
  roughAnnual: number | null;
  comparisonLabel: string | null;
}

export interface GuessDiff {
  direction: 'higher' | 'lower' | 'equal';
  amount: number;
  percent: number | null;
  comparisonLabel: string;
}

export interface GuessAccuracy {
  logError: number;
  withinTolerance: boolean;
}

const NUMBER_TOKEN = /(?<![\d.])(\d+(?:\.\d+)?)\s*(多万|来万|万|w|W|k|K|元|个)?/g;

function toYuan(value: number, unit?: string): number {
  if (unit?.endsWith('万') || unit?.toLowerCase() === 'w' || unit === '个') return value * 10_000;
  if (unit?.toLowerCase() === 'k') return value * 1_000;
  return value;
}

function inferPeriod(raw: string): SalaryPeriod {
  const monthly = /月薪|每月|\/月|月到手|税前月|税后月|月\d/.test(raw);
  const annual = /年薪|年度|每年|\/年|万元\/年|税前年|税后年|总包|年\d/.test(raw);
  if (monthly && !annual) return 'MONTHLY';
  if (annual && !monthly) return 'ANNUAL';
  if (monthly) return 'MONTHLY';
  return 'UNKNOWN';
}

function inferBasis(raw: string): SalaryBasis {
  const afterTax = /税后|到手/.test(raw);
  const pretax = /税前/.test(raw);
  if (afterTax && !pretax) return 'AFTERTAX';
  if (pretax && !afterTax) return 'PRETAX';
  return 'UNKNOWN';
}

function selectMainToken(raw: string, period: SalaryPeriod) {
  const matches = [...raw.matchAll(NUMBER_TOKEN)].map((match) => ({
    raw: match[0],
    index: match.index ?? 0,
    value: Number(match[1]),
    unit: match[2],
  }));
  if (matches.length === 0) return null;

  const first = matches[0];
  if (!first || !Number.isFinite(first.value)) return null;

  const afterFirst = raw.slice(first.index + first.raw.length);
  if (/^\s*[-~至到]\s*\d/.test(afterFirst)) {
    const second = matches[1];
    if (!second || !Number.isFinite(second.value)) return null;
    const sharedUnit = first.unit ?? second.unit;
    const firstAmount = toYuan(first.value, first.unit ?? sharedUnit);
    const secondAmount = toYuan(second.value, second.unit ?? sharedUnit);
    const min = Math.min(firstAmount, secondAmount);
    const max = Math.max(firstAmount, secondAmount);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null;
    return {
      amount: null,
      amountRange: { min, max },
      comparisonLabel: '原文的薪资区间',
    };
  }

  if (matches.length > 1) {
    const prefix = raw.slice(0, first.index);
    const firstIsSalary = /(月薪|年薪|税前|税后|到手|总包|^\s*$)/.test(prefix);
    if (!firstIsSalary) return null;
  }

  return {
    amount: Math.round(toYuan(first.value, first.unit)),
    amountRange: null,
    comparisonLabel:
      period === 'MONTHLY'
        ? '原文的月薪部分'
        : period === 'ANNUAL'
          ? '原文的年薪部分'
          : '原文主金额',
  };
}

export function parseSalary(rawInput: string): ParsedSalary {
  const raw = rawInput.trim();
  const period = inferPeriod(raw);
  const basis = inferBasis(raw);
  const main = selectMainToken(raw, period);
  const comparisonAmount =
    main?.amount ?? (main?.amountRange ? (main.amountRange.min + main.amountRange.max) / 2 : null);
  const amount = main?.amount ?? null;
  const roughAnnual =
    comparisonAmount === null
      ? null
      : period === 'MONTHLY'
        ? comparisonAmount * 12
        : period === 'ANNUAL'
          ? comparisonAmount
          : null;

  return {
    amount,
    amountRange: main?.amountRange ?? null,
    period,
    basis,
    isIntern: /实习/.test(raw),
    hasPlus: /\+|以上|多万/.test(raw),
    roughAnnual,
    comparisonLabel: main?.comparisonLabel ?? null,
  };
}

export function describeGuessDiff(guess: number, parsed: ParsedSalary): GuessDiff | null {
  if (
    !Number.isFinite(guess) ||
    guess < 0 ||
    parsed.period === 'UNKNOWN' ||
    (parsed.amount === null && parsed.amountRange === null) ||
    !parsed.comparisonLabel
  )
    return null;

  if (parsed.amountRange) {
    if (guess < parsed.amountRange.min) {
      const amount = parsed.amountRange.min - guess;
      return {
        direction: 'lower',
        amount,
        percent: amount / parsed.amountRange.min,
        comparisonLabel: parsed.comparisonLabel,
      };
    }
    if (guess > parsed.amountRange.max) {
      const amount = guess - parsed.amountRange.max;
      return {
        direction: 'higher',
        amount,
        percent: amount / parsed.amountRange.max,
        comparisonLabel: parsed.comparisonLabel,
      };
    }
    return {
      direction: 'equal',
      amount: 0,
      percent: 0,
      comparisonLabel: parsed.comparisonLabel,
    };
  }

  if (parsed.amount === null) return null;
  const signed = guess - parsed.amount;
  return {
    direction: signed === 0 ? 'equal' : signed > 0 ? 'higher' : 'lower',
    amount: Math.abs(signed),
    percent: parsed.amount === 0 ? null : Math.abs(signed) / parsed.amount,
    comparisonLabel: parsed.comparisonLabel,
  };
}

export function logRatioError(guess: number, parsed: ParsedSalary): number | null {
  if (!Number.isFinite(guess) || guess <= 0 || parsed.period === 'UNKNOWN') return null;

  const target = parsed.amountRange
    ? guess < parsed.amountRange.min
      ? parsed.amountRange.min
      : guess > parsed.amountRange.max
        ? parsed.amountRange.max
        : guess
    : parsed.amount;
  if (target === null || !Number.isFinite(target) || target <= 0) return null;
  return Math.abs(Math.log(guess / target));
}

export function scoreGuess(
  guess: number,
  parsed: ParsedSalary,
  tolerance = 0.2,
): GuessAccuracy | null {
  const diff = describeGuessDiff(guess, parsed);
  const logError = logRatioError(guess, parsed);
  if (!diff || logError === null || diff.percent === null) return null;
  return { logError, withinTolerance: diff.percent <= tolerance };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function summarizeGuessScores(scores: GuessAccuracy[]) {
  const medianLogError = median(scores.map((score) => score.logError));
  return {
    medianDeviation: medianLogError === null ? null : Math.expm1(medianLogError),
    hitRate: scores.length
      ? scores.filter((score) => score.withinTolerance).length / scores.length
      : null,
  };
}

export function salaryPrompt(period: SalaryPeriod, basis: SalaryBasis, isIntern = false): string {
  const basisText = basis === 'PRETAX' ? '税前' : basis === 'AFTERTAX' ? '税后/到手' : '';
  const periodText =
    period === 'MONTHLY' ? '月薪' : period === 'ANNUAL' ? '年薪' : '年薪（口径不明）';
  return `请猜${isIntern ? '实习期' : ''}${basisText}${periodText}`;
}

export function formatSalaryAmount(amount: number, period: SalaryPeriod): string {
  const unit = period === 'MONTHLY' ? '/ 月' : '/ 年';
  return `${new Intl.NumberFormat('zh-CN').format(amount)} 元 ${unit}`;
}
