export type TitleQuality = 0 | 1 | 2 | 3;

export interface MeetMetadata {
  title: string | null;
  quality: TitleQuality;
  localName: string | null;
}

export interface MetadataDocument {
  title: string;
  querySelector: (selector: string) => { textContent: string | null } | null;
}

const GENERIC_TITLES = new Set(['meet', 'google meet', 'new meeting']);

export function titleQualityFor(title: string, meetCode: string): TitleQuality {
  const cleaned = title.trim();
  if (!cleaned) return 0;
  const lowered = cleaned.toLocaleLowerCase();
  if (GENERIC_TITLES.has(lowered)) return 0;
  if (meetCode && cleaned === `Meet ${meetCode}`) return 1;
  if (meetCode && cleaned === meetCode) return 1;
  return 3;
}

export function resolveMeetingMetadata(doc: MetadataDocument, meetCode: string): MeetMetadata {
  const rawTitle = doc.title.trim().replace(/\s*-\s*Google Meet\s*$/i, '').trim();
  const title = rawTitle && !GENERIC_TITLES.has(rawTitle.toLocaleLowerCase()) ? rawTitle : null;
  const localName = doc.querySelector('[data-self-name]')?.textContent?.trim() || null;
  return { title, quality: title ? titleQualityFor(title, meetCode) : 0, localName };
}

export function resolveSpeakerName(speakerLabel: string | null, localName: string | null): string | null {
  if (!speakerLabel) return null;
  const label = speakerLabel.trim();
  if (label.toLocaleLowerCase() === 'you' && localName?.trim()) return localName.trim();
  return label || null;
}

export function shouldUpgradeTitle(currentTitle: string, currentQuality: TitleQuality, candidateTitle: string, candidateQuality: TitleQuality): boolean {
  if (!candidateTitle.trim()) return false;
  return candidateQuality > currentQuality;
}
