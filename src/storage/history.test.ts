import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDatabase, deleteDatabase } from './db';
import { createMeeting, deleteMeeting, getMeeting, listMeetings, setMeetingArchived } from './meetings';
import { upsertSegment } from './segments';

afterEach(async () => {
  closeDatabase();
  await deleteDatabase();
});

let startedAt = 1000;
const meeting = (id: string, title: string) => {
  startedAt += 1000;
  return {
    id,
    title,
    meetUrl: `https://meet.google.com/${id}`,
    startedAt,
    createdAt: startedAt,
  };
};

describe('history management', () => {
  it('archives, hides by default, lists on filter, and restores', async () => {
    await createMeeting(meeting('m1', 'First'));
    await createMeeting(meeting('m2', 'Second'));
    await setMeetingArchived('m1', 2000);
    expect((await listMeetings()).map((entry) => entry.id)).toEqual(['m2']);
    expect((await listMeetings({ includeArchived: true })).map((entry) => entry.id)).toEqual(['m2', 'm1']);
    await setMeetingArchived('m1', null);
    expect((await listMeetings()).map((entry) => entry.id)).toEqual(['m2', 'm1']);
    expect((await getMeeting('m1'))?.archivedAt).toBeUndefined();
  });

  it('deletes the meeting record and all of its segments', async () => {
    await createMeeting(meeting('m1', 'First'));
    await createMeeting(meeting('m2', 'Second'));
    await upsertSegment({
      id: 's1', meetingId: 'm1', speaker: 'Alief', text: 'Halo',
      startedAt: 1000, endedAt: 1500, relativeStartMs: 0,
    });
    await upsertSegment({
      id: 's2', meetingId: 'm2', speaker: 'Mahdi', text: 'Iya',
      startedAt: 1000, endedAt: 1500, relativeStartMs: 0,
    });
    await deleteMeeting('m1');
    expect((await listMeetings({ includeArchived: true })).map((entry) => entry.id)).toEqual(['m2']);
    const { listSegments } = await import('./segments');
    expect(await listSegments('m1')).toEqual([]);
    expect(await listSegments('m2')).toHaveLength(1);
  });
});
