const chineseDigits: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseNumber(value: string): number | null {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === '十') return 10;
  if (value.startsWith('十')) return 10 + (chineseDigits[value[1] ?? ''] ?? 0);
  if (value.endsWith('十')) return (chineseDigits[value[0] ?? ''] ?? 0) * 10;
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (chineseDigits[tens ?? ''] ?? 0) * 10 + (chineseDigits[ones ?? ''] ?? 0);
  }
  return chineseDigits[value] ?? null;
}

export function parseTenure(textInput: string): number | null {
  const text = textInput.trim();
  if (!text || /未知|刚签|刚毕业|未入职|应届/.test(text)) return null;

  const monthMatch = text.match(/([\d.]+|[零一二两三四五六七八九十]+)\s*(?:个)?月/);
  if (monthMatch?.[1]) return parseNumber(monthMatch[1]);

  const yearMatch = text.match(/([\d.]+|[零一二两三四五六七八九十]+)\s*年/);
  if (!yearMatch?.[1]) return null;
  const years = parseNumber(yearMatch[1]);
  if (years === null) return null;
  return Math.round(years * 12 + (/年半/.test(text) ? 6 : 0));
}
