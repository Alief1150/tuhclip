import JSZip from 'jszip';
import { toJSON } from './json';
import { toMarkdown } from './markdown';
import { toText } from './text';
import type { MeetingSession } from '../storage/meetings';
import { listSegments } from '../storage/segments';

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'meeting';
}

export interface HistoryZipEntry {
  meeting: MeetingSession;
}

export async function buildHistoryZip(
  entries: HistoryZipEntry[],
  meta: { version: string; exportedAt: number },
): Promise<Blob> {
  const zip = new JSZip();
  const manifest: {
    exportedAt: number;
    tuhclipVersion: string;
    meetings: Array<{ id: string; title: string; folder: string; lines: number }>;
  } = { exportedAt: meta.exportedAt, tuhclipVersion: meta.version, meetings: [] };
  const usedFolders = new Set<string>();

  for (const { meeting } of entries) {
    const segments = await listSegments(meeting.id);
    let folder = sanitizeFileName(meeting.title || meeting.id);
    let suffix = 1;
    while (usedFolders.has(folder)) {
      suffix += 1;
      folder = `${sanitizeFileName(meeting.title || meeting.id)}-${suffix}`;
    }
    usedFolders.add(folder);
    zip.folder(folder)?.file('transcript.txt', toText(meeting, segments));
    zip.folder(folder)?.file('transcript.md', toMarkdown(meeting, segments));
    zip.folder(folder)?.file('transcript.json', toJSON(meeting, segments));
    manifest.meetings.push({ id: meeting.id, title: meeting.title, folder, lines: segments.length });
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
