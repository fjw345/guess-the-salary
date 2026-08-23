import { describe, expect, it } from 'vitest';
import { summarizeDatasetStats } from './dataset-stats.js';

describe('dataset stats', () => {
  it('summarizes only approved public data using annualized salaries', () => {
    const stats = summarizeDatasetStats([
      {
        status: 'APPROVED',
        degree: '本科',
        schoolNameRaw: '甲大学',
        hideSchool: false,
        major: '计算机',
        city: '北京',
        position: '开发',
        roughAnnual: 240_000,
        salaryRaw: '税前月2万',
        authorNote: '实习很重要，实习也要认真。',
      },
      {
        status: 'APPROVED',
        degree: '硕士',
        schoolNameRaw: '乙大学',
        hideSchool: true,
        major: '计算机',
        city: '北京',
        position: '算法',
        roughAnnual: 360_000,
        salaryRaw: '税前年36万',
        authorNote: '实习之后找到方向。',
      },
      {
        status: 'REJECTED',
        degree: '博士',
        schoolNameRaw: '丙大学',
        hideSchool: false,
        major: '材料',
        city: '上海',
        position: '研究员',
        roughAnnual: 2_000_000,
        salaryRaw: '税前年200万',
        authorNote: '这条不应出现。',
      },
    ]);

    expect(stats.totalSubmissions).toBe(2);
    expect(stats.medianAnnualSalary).toBe(300_000);
    expect(stats.topCities[0]).toEqual({ label: '北京', count: 2 });
    expect(stats.degreeSalaries).toEqual([
      { degree: '本科', count: 1, average: 240_000, minimum: 240_000, maximum: 240_000 },
      { degree: '硕士', count: 1, average: 360_000, minimum: 360_000, maximum: 360_000 },
      { degree: '博士', count: 0, average: null, minimum: null, maximum: null },
    ]);
    expect(stats.topSchools).toEqual([{ school: '甲大学', count: 1, average: 240_000 }]);
    expect(stats.topWords[0]).toEqual({ word: '实习', count: 3 });
  });
});
