import { describe, expect, it } from 'vitest';
import { classificationCounts } from './school-classifications.js';
import { findSchool, knownSchools, searchSchools } from './schools.js';

describe('mainland university catalog', () => {
  it('loads every unique school and gives each one at least a region tag', () => {
    expect(knownSchools).toHaveLength(3_309);
    expect(new Set(knownSchools.map((school) => school.name)).size).toBe(3_309);
    expect(knownSchools.every((school) => school.tags.length > 0)).toBe(true);
  });

  it('uses complete official classification sets', () => {
    expect(classificationCounts).toEqual({
      c9: 9,
      project985: 39,
      project211: 115,
      doubleFirstClass: 147,
    });
    expect(findSchool('北京大学')?.tags).toEqual(['C9', '985', '211', '双一流', '本科', '北京']);
    expect(findSchool('南京邮电大学')?.tags).toEqual(['双一流', '本科', '江苏']);
    expect(findSchool('北京服装学院')?.tags).toEqual(['本科', '北京']);
  });

  it('does not repeat the old incorrect C9/985/211 labels for UCAS', () => {
    expect(findSchool('中国科学院大学')?.tags).toEqual(['双一流', '本科', '北京']);
  });

  it('inherits classifications for branch campuses and medical schools', () => {
    expect(findSchool('哈尔滨工业大学(深圳)')?.tags).toEqual([
      'C9',
      '985',
      '211',
      '双一流',
      '本科',
      '广东',
    ]);
    expect(findSchool('北京大学医学部')?.tags).toEqual([
      'C9',
      '985',
      '211',
      '双一流',
      '本科',
      '北京',
    ]);
  });

  it('assigns exactly one undergraduate or junior-college level', () => {
    expect(findSchool('北京工业职业技术学院')?.tags).toContain('专科');
    expect(findSchool('天津职业大学')?.tags).toContain('本科');
    expect(findSchool('南京工业职业技术大学')?.tags).toContain('本科');
    expect(
      knownSchools.every(
        (school) => school.tags.filter((tag) => tag === '本科' || tag === '专科').length === 1,
      ),
    ).toBe(true);
  });

  it('includes schools and current names approved after the original catalog cutoff', () => {
    expect(findSchool('福耀科技大学')?.name).toBe('福建福耀科技大学');
    expect(findSchool('福建福耀科技大学')?.tags).toEqual(['本科', '福建']);
    expect(findSchool('上海体育大学')?.tags).toEqual(['双一流', '本科', '上海']);
    expect(findSchool('广东江门南粤学院')?.tags).toEqual(['本科', '广东']);
    expect(findSchool('张家口应用技术职业学院')?.tags).toEqual(['专科', '河北']);
    expect(findSchool('天津职业大学')?.tags).toEqual(['本科', '天津']);
  });

  it('prioritizes exact names and aliases in autocomplete results', () => {
    expect(findSchool('北大')?.name).toBe('北京大学');
    expect(searchSchools('北大')[0]?.name).toBe('北京大学');
    expect(searchSchools('工业大学')).toHaveLength(8);
  });
});
