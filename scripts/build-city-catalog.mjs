import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../output/city-source.html', import.meta.url);
const outputPath = new URL('../apps/api/data/cities.json', import.meta.url);

const html = await readFile(sourcePath, 'utf8');
const article = html.match(/<section class="col-12 col-md-8[\s\S]*?<\/section>/)?.[0];
if (!article) throw new Error('没有在来源页面中找到城市正文。');

const paragraphs = Array.from(article.matchAll(/<p>([\s\S]*?)<\/p>/g), ([, value]) =>
  value
    .replace(/<br\s*\/?\s*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim(),
).filter(Boolean);

const records = [];
let province = '';

function cleanName(value) {
  return value
    .trim()
    .replace(/[。；;]$/g, '')
    .replace(/\s+/g, ' ');
}

function canonicalName(value) {
  return cleanName(value)
    .replace(/[（(][^）)]*[）)]$/g, '')
    .replace(/特别行政区$/g, '')
    .replace(/市$/g, '');
}

function addCity(rawName, cityProvince, level) {
  const original = cleanName(rawName);
  const name = canonicalName(original);
  if (!name) return;
  const aliases = new Set([original]);
  if (level !== 'SPECIAL') aliases.add(`${name}市`);
  aliases.delete(name);
  records.push({
    id: `${cityProvince}-${name}`,
    name,
    province: cityProvince,
    level,
    aliases: [...aliases],
  });
}

for (const paragraph of paragraphs) {
  if (paragraph.startsWith('一、直辖市：')) {
    for (const city of paragraph.split('：')[1].split('、')) {
      addCity(city, cleanName(city), 'MUNICIPALITY');
    }
    continue;
  }

  if (/^\d+、.+(?:省|自治区)$/.test(paragraph)) {
    province = paragraph.replace(/^\d+、/, '');
    continue;
  }
  if (
    /^(广西壮族自治区|内蒙古自治区|宁夏回族自治区|西藏自治区|新疆维吾尔自治区)$/.test(paragraph)
  ) {
    province = paragraph;
    continue;
  }
  if (paragraph.startsWith('四、特别行政区：')) {
    for (const city of paragraph.split('：')[1].split('、')) {
      addCity(city, cleanName(city), 'SPECIAL');
    }
    continue;
  }

  const cityLine = paragraph.match(
    /^(地级市|县级市|省直辖县级市|自治区直辖县级市|台湾当局直辖市|省辖市|县辖市)：(.+)$/,
  );
  if (!cityLine || !province) continue;
  const [, type, names] = cityLine;
  const level = type.includes('直辖市')
    ? 'MUNICIPALITY'
    : type === '地级市' || type === '省辖市'
      ? 'PREFECTURE'
      : 'COUNTY';
  for (const city of names.split(/[、，,]/)) addCity(city, province, level);
}

const unique = Array.from(
  new Map(records.map((record) => [`${record.province}|${record.name}`, record])).values(),
);
await writeFile(outputPath, `${JSON.stringify(unique, null, 2)}\n`, 'utf8');
console.log(`从来源页面整理出 ${unique.length} 个城市。`);
