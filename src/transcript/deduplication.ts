import { normalizeForComparison } from './normalization';

export function fingerprint(speaker: string, text: string): string {
  return `${speaker} ${normalizeForComparison(text)}`;
}

export class RecentDedupeCache {
  private entries: { fingerprint: string; finalizedAt: number }[] = [];

  constructor(
    private readonly windowMs: number,
    private readonly maxSize = 50,
  ) {}

  isDuplicate(speaker: string, text: string, now: number): boolean {
    this.evict(now);
    return this.entries.some((entry) => entry.fingerprint === fingerprint(speaker, text));
  }

  record(speaker: string, text: string, now: number): void {
    this.evict(now);
    this.entries.push({ fingerprint: fingerprint(speaker, text), finalizedAt: now });
    if (this.entries.length > this.maxSize) {
      this.entries.splice(0, this.entries.length - this.maxSize);
    }
  }

  private evict(now: number): void {
    this.entries = this.entries.filter((entry) => now - entry.finalizedAt <= this.windowMs);
  }
}
