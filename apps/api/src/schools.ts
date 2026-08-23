import { aliasesBySchool } from './school-classifications.js';
import type { SchoolRecord } from './types.js';
import universityCatalog from '../../../china_mainland_universities.json' with { type: 'json' };

interface UniversityCatalogSchool {
  name: string;
  tags: string[];
}

interface UniversityRegionEntry {
  all: UniversityCatalogSchool[];
}

const catalog = universityCatalog as Record<string, UniversityRegionEntry>;

export const knownSchools: SchoolRecord[] = Object.entries(catalog).flatMap(
  ([region, entry], regionIndex) => {
    if (!Array.isArray(entry.all)) throw new Error(`学校目录中的 ${region} 缺少 all 列表。`);
    const offset = Object.values(catalog)
      .slice(0, regionIndex)
      .reduce((total, current) => total + current.all.length, 0);
    return entry.all.map((school, schoolIndex) => {
      if (typeof school.name !== 'string' || !Array.isArray(school.tags)) {
        throw new Error(`学校目录中的 ${region} 存在无效学校记录。`);
      }
      return {
        id: offset + schoolIndex + 1,
        name: school.name,
        aliases: aliasesBySchool[school.name] ?? [],
        tags: school.tags,
      };
    });
  },
);

function normalizeSchoolName(value: string): string {
  return value.trim().replace(/\s+/g, '').replaceAll('（', '(').replaceAll('）', ')').toLowerCase();
}

export function findSchool(name: string, schools = knownSchools): SchoolRecord | null {
  const normalized = normalizeSchoolName(name);
  return (
    schools.find(
      (school) =>
        normalizeSchoolName(school.name) === normalized ||
        school.aliases.some((alias) => normalizeSchoolName(alias) === normalized),
    ) ?? null
  );
}

export function searchSchools(query: string, schools = knownSchools, limit = 8): SchoolRecord[] {
  const term = normalizeSchoolName(query);
  if (!term) return schools.slice(0, limit);

  const score = (school: SchoolRecord) => {
    const name = normalizeSchoolName(school.name);
    const aliases = school.aliases.map(normalizeSchoolName);
    if (name === term || aliases.includes(term)) return 0;
    if (name.startsWith(term) || aliases.some((alias) => alias.startsWith(term))) return 1;
    return 2;
  };

  return schools
    .filter((school) =>
      [school.name, ...school.aliases].some((value) => normalizeSchoolName(value).includes(term)),
    )
    .sort(
      (left, right) => score(left) - score(right) || left.name.localeCompare(right.name, 'zh-CN'),
    )
    .slice(0, limit);
}
