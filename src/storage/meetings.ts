import { storeGet, storeGetAll, storePut } from './db';

export interface MeetingSession {
  id: string;
  title: string;
  meetUrl: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  createdAt: number;
}

export interface MeetingHistoryEntry extends MeetingSession {
  segmentCount: number;
}

export function meetingTitleFallback(startedAt: number): string {
  const date = new Date(startedAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `Google Meet - ${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function createMeeting(meeting: MeetingSession): Promise<MeetingSession> {
  const existing = await storeGet<MeetingSession>('meetings', meeting.id).catch(() => null);
  if (existing) return existing;
  await storePut('meetings', meeting);
  return meeting;
}

export async function endMeeting(id: string, endedAt: number): Promise<void> {
  const meeting = await storeGet<MeetingSession>('meetings', id).catch(() => null);
  if (!meeting) return;
  await storePut('meetings', {
    ...meeting,
    endedAt,
    durationMs: Math.max(0, endedAt - meeting.startedAt),
  });
}

export async function getMeeting(id: string): Promise<MeetingSession | null> {
  return storeGet<MeetingSession>('meetings', id).catch(() => null);
}

export async function listMeetings(): Promise<MeetingHistoryEntry[]> {
  const [meetings, segments] = await Promise.all([
    storeGetAll<MeetingSession>('meetings').catch(() => []),
    storeGetAll<{ meetingId: string }>('segments').catch(() => []),
  ]);
  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment.meetingId, (counts.get(segment.meetingId) ?? 0) + 1);
  }
  return meetings
    .map((meeting) => ({ ...meeting, segmentCount: counts.get(meeting.id) ?? 0 }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
