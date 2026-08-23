export const schoolTagPriority = ['C9', '985', '211', '双一流', '本科', '专科'] as const;

export function primarySchoolTags(tags: string[]): string[] {
  const overseas = tags
    .filter((tag) => /^QS/.test(tag))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 9999) - Number(b.match(/\d+/)?.[0] ?? 9999));
  if (overseas.length) return overseas.slice(0, 1);

  const domestic = schoolTagPriority.filter((tag) => tags.includes(tag));
  const feature = tags.filter(
    (tag) =>
      !schoolTagPriority.includes(tag as (typeof schoolTagPriority)[number]) && !/^QS/.test(tag),
  );
  return [...domestic.slice(0, 1), ...feature.slice(0, 1)];
}
