import { describe, expect, it } from 'vitest';
import { knownCities, searchCities } from './cities.js';
import { knownMajors, searchMajors } from './majors.js';

describe('major and city suggestion catalogs', () => {
  it('loads the static major catalogs and scopes results by degree', () => {
    expect(knownMajors.length).toBeGreaterThan(800);
    expect(searchMajors('计科', '本科')[0]).toMatchObject({
      name: '计算机科学与技术',
      category: '工学',
    });
    expect(searchMajors('计算机技术', '硕士')[0]).toMatchObject({
      name: '计算机技术',
      degreeTypes: expect.arrayContaining(['MASTER']),
    });
    expect(searchMajors('计算机技术', '本科')).toEqual([]);
  });

  it('loads unique cities and searches names, suffixes and source aliases', () => {
    expect(knownCities).toHaveLength(684);
    expect(new Set(knownCities.map((city) => `${city.province}|${city.name}`)).size).toBe(
      knownCities.length,
    );
    expect(searchCities('上海市')[0]).toMatchObject({ name: '上海', province: '上海市' });
    expect(searchCities('石河子（八师）')[0]).toMatchObject({
      name: '石河子',
      province: '新疆维吾尔自治区',
    });
  });
});
