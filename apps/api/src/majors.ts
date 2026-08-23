import undergraduateCatalog from '../data/undergraduate-majors.json' with { type: 'json' };
import graduateCatalog from '../data/graduate-majors.json' with { type: 'json' };
import { searchCatalog } from './catalog-search.js';
import type { Degree, MajorDegreeType, MajorRecord } from './types.js';

const rawMajors = [...undergraduateCatalog, ...graduateCatalog] as MajorRecord[];

export const knownMajors: MajorRecord[] = rawMajors.sort((left, right) =>
  left.name.localeCompare(right.name, 'zh-CN'),
);

const degreeTypeByDegree: Partial<Record<Degree, MajorDegreeType>> = {
  专科: 'BACHELOR',
  本科: 'BACHELOR',
  硕士: 'MASTER',
  博士: 'DOCTOR',
};

export function searchMajors(
  query: string,
  degree?: Degree,
  majors = knownMajors,
  limit = 8,
): MajorRecord[] {
  const degreeType = degree ? degreeTypeByDegree[degree] : undefined;
  const scoped = degreeType
    ? majors.filter((major) => major.degreeTypes.includes(degreeType))
    : majors;
  return searchCatalog(query, scoped, (major) => [major.category, major.code ?? ''], limit);
}
