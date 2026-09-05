export function normalizeForComparison(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ');
}

export function displayCleanup(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
