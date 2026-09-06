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

export function mergeCumulative(currentDisplay: string, incomingDisplay: string): string | null {
  const current = displayCleanup(currentDisplay);
  const incoming = displayCleanup(incomingDisplay);
  if (!current || !incoming) return current || incoming || null;
  const currentNormalized = normalizeForComparison(current);
  const incomingNormalized = normalizeForComparison(incoming);
  if (!currentNormalized || !incomingNormalized) return current || incoming;
  if (currentNormalized === incomingNormalized) return current;
  if (incomingNormalized.includes(currentNormalized)) return incoming;
  if (currentNormalized.includes(incomingNormalized)) return current;

  const currentWords = current.split(' ');
  const incomingWords = incoming.split(' ');
  const currentNormWords = currentNormalized.split(' ');
  const incomingNormWords = incomingNormalized.split(' ');
  const maxOverlap = Math.min(currentNormWords.length, incomingNormWords.length);
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const suffix = currentNormWords.slice(currentNormWords.length - size);
    const prefix = incomingNormWords.slice(0, size);
    if (suffix.join(' ') === prefix.join(' ')) {
      return [...currentWords, ...incomingWords.slice(size)].join(' ');
    }
  }
  return null;
}
