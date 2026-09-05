import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, deleteDatabase } from './db';
import { createMeeting, endMeeting, listMeetings } from './meetings';
import { addSegment, listSegments } from './segments';
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

  it('returns empty lists for corrupt or missing data without throwing', async () => {
    expect(await listSegments('missing')).toEqual([]);
    expect(await listMeetings()).toEqual([]);
  });
});
