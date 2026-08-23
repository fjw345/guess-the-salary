interface CatalogItem {
  name: string;
  aliases: string[];
}

export function normalizeCatalogText(value: string): string {
  return value.trim().replace(/\s+/g, '').replaceAll('（', '(').replaceAll('）', ')').toLowerCase();
}

export function searchCatalog<T extends CatalogItem>(
  query: string,
  items: T[],
  searchableValues: (item: T) => string[],
  limit = 8,
): T[] {
  const term = normalizeCatalogText(query);
  if (!term) return items.slice(0, limit);

  const valuesFor = (item: T) =>
    [item.name, ...item.aliases, ...searchableValues(item)].map(normalizeCatalogText);
  const score = (item: T) => {
    const values = valuesFor(item);
    if (values.includes(term)) return 0;
    if (values.some((value) => value.startsWith(term))) return 1;
    return 2;
  };

  return items
    .filter((item) => valuesFor(item).some((value) => value.includes(term)))
    .sort(
      (left, right) => score(left) - score(right) || left.name.localeCompare(right.name, 'zh-CN'),
    )
    .slice(0, limit);
}
