import { PrismaClient } from '@prisma/client';
import { buildSeedSubmissions } from './seed.js';
import { knownSchools } from './schools.js';

const degreeMap = { 专科: 'COLLEGE', 本科: 'BACHELOR', 硕士: 'MASTER', 博士: 'DOCTOR' } as const;

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function importSeed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('缺少 DATABASE_URL。请先复制 apps/api/.env.example 并配置 PostgreSQL。');
  }

  const prisma = new PrismaClient();
  try {
    const existingSchools = await prisma.school.findMany();
    const existingByName = new Map(existingSchools.map((school) => [school.name, school]));
    const missingSchools = knownSchools.filter((school) => !existingByName.has(school.name));
    if (missingSchools.length) {
      await prisma.school.createMany({
        data: missingSchools.map((school) => ({
          name: school.name,
          aliases: school.aliases,
          tags: school.tags,
        })),
        skipDuplicates: true,
      });
    }

    const changedSchools = knownSchools.filter((school) => {
      const existing = existingByName.get(school.name);
      return (
        existing &&
        (!sameValues(existing.aliases, school.aliases) || !sameValues(existing.tags, school.tags))
      );
    });
    for (let index = 0; index < changedSchools.length; index += 100) {
      await prisma.$transaction(
        changedSchools.slice(index, index + 100).map((school) =>
          prisma.school.update({
            where: { name: school.name },
            data: { aliases: school.aliases, tags: school.tags },
          }),
        ),
      );
    }

    const databaseSchools = await prisma.school.findMany();
    const databaseSchoolByName = new Map(databaseSchools.map((school) => [school.name, school]));
    const rows = await buildSeedSubmissions();
    for (const row of rows) {
      const school = databaseSchoolByName.get(row.schoolNameRaw);
      const sourceData = {
        degree: degreeMap[row.degree],
        schoolId: school?.id,
        schoolNameRaw: row.schoolNameRaw,
        major: row.major,
        tenureText: row.tenureText,
        tenureMonths: row.tenureMonths,
        city: row.city,
        companyName: row.companyName,
        position: row.position,
        salaryRaw: row.salaryRaw,
        salaryAmount: row.salaryAmount,
        salaryPeriod: row.salaryPeriod,
        salaryBasis: row.salaryBasis,
        salaryIsIntern: row.salaryIsIntern,
        salaryHasPlus: row.salaryHasPlus,
        roughAnnual: row.roughAnnual,
        authorNote: row.authorNote,
        sourceRow: row.sourceRow,
      };
      await prisma.submission.upsert({
        where: { id: row.id },
        // Moderation state and selective hiding belong to administrators, not the workbook.
        update: sourceData,
        create: {
          id: row.id,
          ...sourceData,
          hideSchool: false,
          hideCompany: false,
          status: 'APPROVED',
          sourceType: 'SEED',
          reviewedAt: new Date(),
        },
      });
    }
    console.log(`学校目录 ${knownSchools.length} 所，成功导入 ${rows.length} 条种子数据。`);
  } finally {
    await prisma.$disconnect();
  }
}
