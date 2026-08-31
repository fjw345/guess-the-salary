import { buildSeedSubmissions } from '../src/seed.js';

const rows = await buildSeedSubmissions();
const unknownPeriods = rows.filter((row) => row.salaryPeriod === 'UNKNOWN').length;
const unparsedAmounts = rows.filter(
  (row) => row.salaryAmount === null && row.roughAnnual === null,
).length;

console.log(`Excel 校验通过：${rows.length} 条种子数据。`);
if (unknownPeriods) console.warn(`提示：${unknownPeriods} 条薪资没有明确的月薪/年薪口径。`);
if (unparsedAmounts) console.warn(`提示：${unparsedAmounts} 条薪资无法换算为单一金额。`);
