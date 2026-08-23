import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { parseSalary, parseTenure } from '@guess-salary/shared';
import { findSchool, knownSchools } from './schools.js';
import type { SeedRow, SubmissionRecord } from './types.js';

const seedWorkbookPath = fileURLToPath(new URL('../../../种子数据.xlsx', import.meta.url));

const seedHeaders = [
  '学历',
  '学校',
  '专业',
  '毕业已经',
  '城市',
  '公司名称',
  '岗位',
  '薪资（作为结果出现）',
  '想说的话（作为结果出现）',
] as const;

const requiredSeedHeaders = seedHeaders.filter((header) => header !== '毕业已经');

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value)
      return value.richText
        .map((part) => part.text)
        .join('')
        .trim();
    if ('result' in value) return String(value.result ?? '').trim();
  }
  return String(value).trim();
}

export async function loadSeedRows(): Promise<SeedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(seedWorkbookPath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('种子工作簿中没有可读取的工作表。');

  const headers = seedHeaders.map((_, index) =>
    cellText(worksheet.getRow(1).getCell(index + 1).value),
  );
  const mismatchedHeaders = seedHeaders.filter((header, index) => headers[index] !== header);
  if (mismatchedHeaders.length) {
    throw new Error(`种子工作簿表头不匹配，应为：${seedHeaders.join('、')}。`);
  }

  const rows: SeedRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = seedHeaders.map((_, index) => cellText(row.getCell(index + 1).value));
    if (!values.some(Boolean)) return;

    const missing = requiredSeedHeaders.filter((header) => !values[seedHeaders.indexOf(header)]);
    if (missing.length) {
      throw new Error(`种子工作簿第 ${rowNumber} 行缺少：${missing.join('、')}。`);
    }

    const [
      degree = '',
      schoolNameRaw = '',
      major = '',
      tenureText = '',
      city = '',
      companyName = '',
      position = '',
      salaryRaw = '',
      authorNote = '',
    ] = values;
    if (!['专科', '本科', '硕士', '博士'].includes(degree)) {
      throw new Error(`种子工作簿第 ${rowNumber} 行的学历无效：${degree}。`);
    }

    rows.push({
      sourceRow: rowNumber,
      degree: degree as SeedRow['degree'],
      schoolNameRaw,
      major,
      tenureText: tenureText || '未知',
      city,
      companyName,
      position,
      salaryRaw,
      authorNote,
    });
  });

  if (!rows.length) throw new Error('种子工作簿没有有效数据。');
  return rows;
}

export async function buildSeedSubmissions(): Promise<SubmissionRecord[]> {
  const rows = await loadSeedRows();
  return rows.map((row) => {
    const parsed = parseSalary(row.salaryRaw);
    const school = findSchool(row.schoolNameRaw, knownSchools);
    return {
      id: `seed-${row.sourceRow}`,
      degree: row.degree,
      schoolId: school?.id ?? null,
      schoolNameRaw: row.schoolNameRaw,
      hideSchool: false,
      major: row.major,
      tenureText: row.tenureText,
      tenureMonths: parseTenure(row.tenureText),
      city: row.city,
      companyName: row.companyName,
      hideCompany: false,
      position: row.position,
      salaryRaw: row.salaryRaw,
      salaryAmount: parsed.amount,
      salaryPeriod: parsed.period,
      salaryBasis: parsed.basis,
      salaryIsIntern: parsed.isIntern,
      salaryHasPlus: parsed.hasPlus,
      roughAnnual: parsed.roughAnnual,
      authorNote: row.authorNote || null,
      status: 'APPROVED',
      rejectReason: null,
      sourceType: 'SEED',
      submittedAt: new Date('2026-08-13T00:00:00.000Z').toISOString(),
      reviewedAt: new Date('2026-08-13T00:00:00.000Z').toISOString(),
      ipHash: null,
      sourceRow: row.sourceRow,
      school,
    };
  });
}
