import { storeGet, storeGetAll, storePut } from './db';
import { listSegments } from './segments';
import type { TranscriptSegment } from '../transcript/types';

export interface RecentTurnSummary {
  id: string;
  speaker: string;
  text: string;
  endedAt: number;
}

export interface MeetingSession {
  id: string;
  title: string;
  meetUrl: string;
  meetCode?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  createdAt: number;
}

export const SESSION_RESUME_WINDOW_MS = 10 * 60 * 1000;
export const MEETING_RESUME_WINDOW_MS = SESSION_RESUME_WINDOW_MS;

export function meetingIdForCode(meetCode: string): string {
  return `meet-${meetCode}`;
}

async function recentTurnFor(meetingId: string): Promise<RecentTurnSummary | null> {
  const segments: TranscriptSegment[] = await listSegments(meetingId).catch(() => []);
  if (segments.length === 0) return null;
  const latest = segments.reduce((a, b) => (b.endedAt >= a.endedAt ? b : a));
  return { id: latest.id, speaker: latest.speaker, text: latest.text, endedAt: latest.endedAt };
}

export async function getOrResumeMeeting(
  meetCode: string,
  info: { title: string; meetUrl: string },
  now: number = Date.now(),
): Promise<{ meeting: MeetingSession; resumed: boolean; recentTurn: RecentTurnSummary | null }> {
  const fallbackTitle = info.title.trim() || meetingTitleFallback(now, meetCode);
  if (!meetCode) {
    const fresh: MeetingSession = {
      id: `meet-${now.toString(36)}`,
      title: fallbackTitle,
      meetUrl: info.meetUrl,
      startedAt: now,
      createdAt: now,
    };
    await storePut('meetings', fresh);
    return { meeting: fresh, resumed: false, recentTurn: null };
  }
  const existing = await getMeeting(meetingIdForCode(meetCode)).catch(() => null);
  if (existing && now - existing.startedAt <= MEETING_RESUME_WINDOW_MS) {
    const reopened: MeetingSession = { ...existing };
    delete reopened.endedAt;
    delete reopened.durationMs;
    await storePut('meetings', reopened);
    return { meeting: reopened, resumed: true, recentTurn: await recentTurnFor(existing.id) };
  }
  const meeting: MeetingSession = {
    id: existing ? `meet-${meetCode}-${now.toString(36)}` : meetingIdForCode(meetCode),
    title: fallbackTitle,
    meetUrl: info.meetUrl,
    meetCode,
    startedAt: now,
    createdAt: now,
  };
  await storePut('meetings', meeting);
  return { meeting, resumed: false, recentTurn: null };
}

export interface MeetingHistoryEntry extends MeetingSession {
  segmentCount: number;
}

export function meetingTitleFallback(startedAt: number, meetCode?: string): string {
  if (meetCode?.trim()) return `Meet ${meetCode.trim()}`;
  const date = new Date(startedAt);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `Google Meet - ${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function meetCodeFromUrl(meetUrl: string): string {
  const match = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : '';
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
