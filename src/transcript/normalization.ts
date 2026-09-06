export function normalizeForComparison(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function displayCleanup(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
