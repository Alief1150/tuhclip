import 'fake-indexeddb/auto';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, deleteDatabase } from '../storage/db';
import { createMeeting } from '../storage/meetings';
import { upsertSegment } from '../storage/segments';
import { buildHistoryZip, sanitizeFileName } from './zip';

afterEach(async () => {
  closeDatabase();
  await deleteDatabase();
});

describe('history ZIP export', () => {
  it('packages selected meetings with valid TXT/MD/JSON and no cross-session data', async () => {
    const first = await createMeeting({
      id: 'meeting-A', title: 'Kelas Jaringan!', meetUrl: 'https://meet.google.com/a',
      startedAt: 1000, createdAt: 1000,
    });
    const second = await createMeeting({
      id: 'meeting-B', title: 'Weekly', meetUrl: 'https://meet.google.com/b',
      startedAt: 2000, createdAt: 2000,
    });
    await createMeeting({
      id: 'meeting-C', title: 'Excluded', meetUrl: 'https://meet.google.com/c',
      startedAt: 3000, createdAt: 3000,
    });
    await upsertSegment({
      id: 'a1', meetingId: 'meeting-A', speaker: 'Alief', text: 'hello A',
      startedAt: 1100, endedAt: 1200, relativeStartMs: 100,
    });
    await upsertSegment({
      id: 'b1', meetingId: 'meeting-B', speaker: 'Mahdi', text: 'hello B',
      startedAt: 2100, endedAt: 2200, relativeStartMs: 100,
    });

    const blob = await buildHistoryZip(
      [{ meeting: first }, { meeting: second }],
      { version: '0.3.4', exportedAt: 9999 },
    );
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files);
    expect(names).toContain('kelas-jaringan/transcript.txt');
    expect(names).toContain('weekly/transcript.md');
    expect(names).toContain('weekly/transcript.json');
    expect(names).toContain('manifest.json');
    expect(names.some((name) => name.includes('excluded') || name.includes('Excluded'))).toBe(false);

    const txtA = await zip.file('kelas-jaringan/transcript.txt')?.async('string');
    expect(txtA).toContain('hello A');
    expect(txtA).not.toContain('hello B');
    const manifest = JSON.parse((await zip.file('manifest.json')?.async('string')) ?? '{}') as {
      tuhclipVersion: string;
      meetings: Array<{ id: string }>;
    };
    expect(manifest.tuhclipVersion).toBe('0.3.4');
    expect(manifest.meetings.map((entry) => entry.id)).toEqual(['meeting-A', 'meeting-B']);
  });

  it('sanitizes folder names', () => {
    expect(sanitizeFileName('Kelas Jaringan!')).toBe('kelas-jaringan');
    expect(sanitizeFileName('  ')).toBe('meeting');
  });
});
