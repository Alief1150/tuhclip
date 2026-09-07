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

export type ReconcileKind =
  | 'EXACT'
  | 'EXTENSION'
  | 'ROLLBACK'
  | 'ROLLING_OVERLAP'
  | 'PREFIX_REVISION'
  | 'NEW_CONTENT';

export interface ReconcileResult {
  kind: ReconcileKind;
  merged: string | null;
}

const MIN_REVISION_PREFIX_WORDS = 4;
const MIN_REVISION_PREFIX_CHARS = 20;

function commonPrefixWords(a: string[], b: string[]): number {
  let count = 0;
  while (count < a.length && count < b.length && a[count] === b[count]) {
    count += 1;
  }
  return count;
}

export function reconcileSnapshots(currentDisplay: string, incomingDisplay: string): ReconcileResult {
  const current = displayCleanup(currentDisplay);
  const incoming = displayCleanup(incomingDisplay);
  if (!current || !incoming) {
    return { kind: 'NEW_CONTENT', merged: current || incoming || null };
  }
  const currentNormalized = normalizeForComparison(current);
  const incomingNormalized = normalizeForComparison(incoming);
  if (!currentNormalized || !incomingNormalized) {
    return { kind: 'NEW_CONTENT', merged: current || incoming };
  }
  if (currentNormalized === incomingNormalized) return { kind: 'EXACT', merged: current };
  if (incomingNormalized.includes(currentNormalized)) return { kind: 'EXTENSION', merged: incoming };
  if (currentNormalized.includes(incomingNormalized)) return { kind: 'ROLLBACK', merged: current };

  const currentWords = current.split(' ');
  const incomingWords = incoming.split(' ');
  const currentNormWords = currentNormalized.split(' ');
  const incomingNormWords = incomingNormalized.split(' ');
  const maxOverlap = Math.min(currentNormWords.length, incomingNormWords.length);
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const suffix = currentNormWords.slice(currentNormWords.length - size);
    const prefix = incomingNormWords.slice(0, size);
    if (suffix.join(' ') === prefix.join(' ')) {
      return { kind: 'ROLLING_OVERLAP', merged: [...currentWords, ...incomingWords.slice(size)].join(' ') };
    }
  }

  const sharedPrefixSize = commonPrefixWords(currentNormWords, incomingNormWords);
  if (sharedPrefixSize >= MIN_REVISION_PREFIX_WORDS) {
    const sharedPrefix = currentNormWords.slice(0, sharedPrefixSize).join(' ');
    const shorterLength = Math.min(currentNormWords.length, incomingNormWords.length);
    if (sharedPrefix.length >= MIN_REVISION_PREFIX_CHARS && sharedPrefixSize < shorterLength) {
      return { kind: 'PREFIX_REVISION', merged: incoming };
    }
  }

  return { kind: 'NEW_CONTENT', merged: null };
}

export function mergeCumulative(currentDisplay: string, incomingDisplay: string): string | null {
  return reconcileSnapshots(currentDisplay, incomingDisplay).merged;
}
