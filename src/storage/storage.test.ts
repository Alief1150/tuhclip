import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, deleteDatabase } from './db';
import { createMeeting, endMeeting, getOrResumeMeeting, listMeetings } from './meetings';
import { addSegment, listSegments, upsertSegment } from './segments';
import { readSetting, writeSetting } from './settings';

afterEach(async () => {
  closeDatabase();
  await deleteDatabase();
});

describe('storage', () => {
  it('creates meetings, appends segments, and lists history newest-first', async () => {
    const first = await createMeeting({
      id: 'm1',
      title: 'First',
      meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
      startedAt: 1000,
      createdAt: 1000,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createMeeting({
      id: 'm2',
      title: 'Second',
      meetUrl: 'https://meet.google.com/ddd-eeee-fff',
      startedAt: 2000,
      createdAt: 2000,
    });
    await addSegment({
      id: 's1', meetingId: first.id, speaker: 'Alief', text: 'Halo',
      startedAt: 1100, endedAt: 1200, relativeStartMs: 100,
    });
    await addSegment({
      id: 's1', meetingId: first.id, speaker: 'Alief', text: 'Halo',
      startedAt: 1100, endedAt: 1200, relativeStartMs: 100,
    });

    const history = await listMeetings();
    expect(history.map((meeting) => meeting.id)).toEqual(['m2', 'm1']);
    expect(history[1].segmentCount).toBe(1);

    const stored = await listSegments('m1');
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Halo');
  });

  it('closes meetings cleanly and reads settings safely', async () => {
    await createMeeting({
      id: 'm1', title: 'Call', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
      startedAt: 1000, createdAt: 1000,
    });
    await endMeeting('m1', 5000);
    const [meeting] = await listMeetings();
    expect(meeting.endedAt).toBe(5000);
    expect(meeting.durationMs).toBe(4000);

    expect(await readSetting('unknown-key')).toBeNull();
    await writeSetting('theme', 'light');
    expect(await readSetting('theme')).toBe('light');
  });

  it('reuses the meeting inside the resume window and clears the ended state', async () => {
    const first = await getOrResumeMeeting('aaa-bbbb-ccc', { title: 'Call', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc' }, 1000);
    expect(first.resumed).toBe(false);
    await endMeeting(first.meeting.id, 2000);
    const resumed = await getOrResumeMeeting('aaa-bbbb-ccc', { title: 'Call', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc' }, 1000 + 5 * 60_000);
    expect(resumed.resumed).toBe(true);
    expect(resumed.meeting.id).toBe(first.meeting.id);
    expect(resumed.meeting.endedAt).toBeUndefined();
  });

  it('starts a new session after the resume window expires', async () => {
    const first = await getOrResumeMeeting('aaa-bbbb-ccc', { title: 'Call', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc' }, 1000);
    const later = await getOrResumeMeeting('aaa-bbbb-ccc', { title: 'Call', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc' }, 1000 + 11 * 60_000);
    expect(later.resumed).toBe(false);
    expect(later.meeting.id).not.toBe(first.meeting.id);
  });

  it('upserts turns by stable id instead of inserting duplicates', async () => {
    await upsertSegment({
      id: 't1', meetingId: 'm1', speaker: 'Alief', text: 'halo bandung',
      startedAt: 1000, endedAt: 1500, relativeStartMs: 0,
    });
    const result = await upsertSegment({
      id: 't1', meetingId: 'm1', speaker: 'Alief', text: 'halo bandung sudah lama beta',
      startedAt: 1000, endedAt: 2500, relativeStartMs: 0,
    });
    expect(result).toBe('updated');
    const stored = await listSegments('m1');
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('halo bandung sudah lama beta');
  });

  it('keeps transcripts isolated per meeting', async () => {
    await upsertSegment({
      id: 'a1', meetingId: 'meeting-A', speaker: 'Alief', text: 'hello A',
      startedAt: 1000, endedAt: 1500, relativeStartMs: 0,
    });
    await upsertSegment({
      id: 'b1', meetingId: 'meeting-B', speaker: 'Mahdi', text: 'hello B',
      startedAt: 1000, endedAt: 1500, relativeStartMs: 0,
    });
    expect((await listSegments('meeting-A')).map((segment) => segment.text)).toEqual(['hello A']);
    expect((await listSegments('meeting-B')).map((segment) => segment.text)).toEqual(['hello B']);
  });

  it('resolves meeting titles with meet-code fallback', async () => {
    const { meetingTitleFallback, meetCodeFromUrl } = await import('./meetings');
    expect(meetingTitleFallback(1000, 'abc-defg-hij')).toBe('Meet abc-defg-hij');
    expect(meetingTitleFallback(1000)).toContain('Google Meet');
    expect(meetCodeFromUrl('https://meet.google.com/abc-defg-hij')).toBe('abc-defg-hij');
    expect(meetCodeFromUrl('https://example.com')).toBe('');
  });

  it('returns empty lists for corrupt or missing data without throwing', async () => {
    expect(await listSegments('missing')).toEqual([]);
    expect(await listMeetings()).toEqual([]);
  });
});
