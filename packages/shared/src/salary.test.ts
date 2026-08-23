import { describe, expect, it } from 'vitest';
import {
  describeGuessDiff,
  logRatioError,
  parseSalary,
  salaryPrompt,
  scoreGuess,
} from './salary.js';
import { primarySchoolTags } from './school.js';
import { parseTenure } from './tenure.js';

describe('parseSalary', () => {
  it.each([
    ['税前月1w', 10_000, 'MONTHLY', 'PRETAX', false, false],
    ['税前年60w', 600_000, 'ANNUAL', 'PRETAX', false, false],
    ['月薪税前7500元', 7_500, 'MONTHLY', 'PRETAX', false, false],
    ['税后74万元/年', 740_000, 'ANNUAL', 'AFTERTAX', false, false],
    ['4.4W/月', 44_000, 'MONTHLY', 'UNKNOWN', false, false],
    ['120w+', 1_200_000, 'UNKNOWN', 'UNKNOWN', false, true],
    ['税前年薪300多万', 3_000_000, 'ANNUAL', 'PRETAX', false, true],
    ['税前年薪300来万', 3_000_000, 'ANNUAL', 'PRETAX', false, false],
    ['实习期税前月薪8000', 8_000, 'MONTHLY', 'PRETAX', true, false],
    ['税前月薪7k，年终奖8w', 7_000, 'MONTHLY', 'PRETAX', false, false],
    ['年薪200万港币', 2_000_000, 'ANNUAL', 'UNKNOWN', false, false],
  ] as const)('%s', (raw, amount, period, basis, isIntern, hasPlus) => {
    expect(parseSalary(raw)).toMatchObject({ amount, period, basis, isIntern, hasPlus });
  });

  it('preserves a salary range instead of pretending it is precise', () => {
    expect(parseSalary('50-70万/年，15薪，年终奖2-3个月')).toMatchObject({
      amount: null,
      amountRange: { min: 500_000, max: 700_000 },
      period: 'ANNUAL',
    });
  });
});

describe('display helpers', () => {
  it('describes a neutral difference and guards unparsed values', () => {
    expect(describeGuessDiff(12_000, parseSalary('税前月薪7k，年终奖8w'))).toMatchObject({
      direction: 'higher',
      amount: 5_000,
      percent: 5 / 7,
    });
    expect(describeGuessDiff(12_000, parseSalary('50-70万'))).toBeNull();
    expect(describeGuessDiff(600_000, parseSalary('50-70万/年'))).toMatchObject({
      direction: 'equal',
      amount: 0,
      percent: 0,
    });
    expect(describeGuessDiff(800_000, parseSalary('50-70万/年'))).toMatchObject({
      direction: 'higher',
      amount: 100_000,
      percent: 1 / 7,
    });
    expect(describeGuessDiff(12_000, parseSalary('税前12w'))).toBeNull();
  });

  it('uses symmetric log error and a tolerance score for comparable salaries', () => {
    const parsed = parseSalary('税前月薪10w');
    expect(logRatioError(200_000, parsed)).toBeCloseTo(Math.log(2));
    expect(logRatioError(50_000, parsed)).toBeCloseTo(Math.log(2));
    expect(scoreGuess(120_000, parsed)).toMatchObject({ withinTolerance: true });
    expect(scoreGuess(130_000, parsed)).toMatchObject({ withinTolerance: false });
  });

  it('renders unknown salary periods explicitly', () => {
    expect(salaryPrompt('UNKNOWN', 'UNKNOWN')).toContain('口径不明');
  });
});

describe('tenure and school helpers', () => {
  it.each([
    ['2年', 24],
    ['三个月', 3],
    ['一年半', 18],
    ['6个月', 6],
    ['刚签', null],
    ['刚毕业', null],
    ['未知', null],
  ])('parses %s', (raw, expected) => expect(parseTenure(raw)).toBe(expected));

  it('selects the highest useful school tags', () => {
    expect(primarySchoolTags(['双一流', '211', '985'])).toEqual(['985']);
    expect(primarySchoolTags(['QS前100', 'QS前200'])).toEqual(['QS前100']);
    expect(primarySchoolTags(['本科', '北京'])).toEqual(['本科', '北京']);
    expect(primarySchoolTags([])).toEqual([]);
  });
});
