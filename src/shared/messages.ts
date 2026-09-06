export type SessionSignals = {
  onMeet: boolean;
  contentReady: boolean;
  contentMissing: boolean;
  backgroundMeetingId: string | null;
  lifecycle: MeetingLifecycle;
};

export type MeetingLifecycle = 'waiting' | 'active' | 'ended';

export type RuntimeMessage =
  | { type: 'GET_SESSION_STATUS' }
  | { type: 'GET_CONTENT_STATUS' }
  | { type: 'CONTENT_STATUS'; payload: { signal: MeetStateSignal } }
  | { type: 'CONTENT_SCRIPT_READY'; payload: { meetCode: string; url: string; startedAt: number } }
  | {
      type: 'GET_OR_RESUME_MEETING_SESSION';
      payload: { meetCode: string; title: string; meetUrl: string; now: number };
    }
  | {
      type: 'MEETING_SESSION';
      payload: {
        meetingId: string;
        startedAt: number;
        resumed: boolean;
        recentTurn: { id: string; speaker: string; text: string; endedAt: number } | null;
      };
    }
  | {
      type: 'SESSION_ENDED';
      payload: { meetingId: string; endedAt: number };
    }
  | {
      type: 'MEET_HEARTBEAT';
      payload: { meetingId: string; meetCode: string; timestamp: number };
    }
  | { type: 'GET_ACTIVE_SESSIONS' }
  | { type: 'ACTIVE_SESSIONS'; payload: { sessions: RuntimeSession[] } }
  | { type: 'PING_CONTENT_SCRIPT' }
  | { type: 'PONG_CONTENT_SCRIPT'; payload: { meetCode: string; signal: MeetStateSignal } }
  | { type: 'SESSION_STATUS'; payload: SessionSignals }
  | { type: MeetStateSignal }
  | { type: 'CAPTION_OBSERVATION'; payload: CaptionObservation }
  | { type: 'TRANSCRIPT_SEGMENT'; payload: TranscriptSegment }
  | { type: 'TRANSCRIPT_TURN'; payload: TranscriptTurn }
  | {
      type: 'MEETING_STARTED';
      payload: { meetingId: string; title: string; meetUrl: string; startedAt: number };
    };

const isLifecycle = (value: unknown): value is MeetingLifecycle =>
  value === 'waiting' || value === 'active' || value === 'ended';

const isSignals = (value: unknown): value is SessionSignals => {
  if (!value || typeof value !== 'object') return false;
  const signals = value as Record<string, unknown>;
  return typeof signals.onMeet === 'boolean'
    && typeof signals.contentReady === 'boolean'
    && typeof signals.contentMissing === 'boolean'
    && (signals.backgroundMeetingId === null || typeof signals.backgroundMeetingId === 'string')
    && isLifecycle(signals.lifecycle);
};

const meetStateSignals: MeetStateSignal[] = ['MEET_DETECTED', 'CAPTIONS_WAITING', 'CAPTIONS_ACTIVE', 'CAPTIONS_INACTIVE'];

const isMeetStateSignal = (value: unknown): value is MeetStateSignal =>
  typeof value === 'string' && meetStateSignals.includes(value as MeetStateSignal);

const isCaptionObservation = (value: unknown): value is CaptionObservation => {
  if (!value || typeof value !== 'object') return false;
  const observation = value as Record<string, unknown>;
  return (typeof observation.speaker === 'string' || observation.speaker === null)
    && typeof observation.text === 'string'
    && observation.text.length > 0
    && typeof observation.observedAt === 'number'
    && (observation.sourceId === undefined || typeof observation.sourceId === 'string');
};

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object' || typeof (value as { type?: unknown }).type !== 'string') {
    return false;
  }

  const message = value as { type: string; payload?: unknown };
  if (message.type === 'GET_SESSION_STATUS'
    || message.type === 'GET_CONTENT_STATUS'
    || message.type === 'PING_CONTENT_SCRIPT'
    || message.type === 'GET_ACTIVE_SESSIONS') {
    return message.payload === undefined;
  }
  if (message.type === 'MEET_HEARTBEAT') {
    return !!message.payload
      && typeof message.payload === 'object'
      && typeof (message.payload as Record<string, unknown>).meetingId === 'string'
      && typeof (message.payload as Record<string, unknown>).meetCode === 'string'
      && typeof (message.payload as Record<string, unknown>).timestamp === 'number';
  }
  if (message.type === 'ACTIVE_SESSIONS') {
    return !!message.payload
      && typeof message.payload === 'object'
      && Array.isArray((message.payload as Record<string, unknown>).sessions)
      && ((message.payload as Record<string, unknown>).sessions as unknown[]).every(isRuntimeSession);
  }
  if (message.type === 'CONTENT_SCRIPT_READY') return isContentScriptReady(message.payload);
  if (message.type === 'GET_OR_RESUME_MEETING_SESSION') {
    return !!message.payload
      && typeof message.payload === 'object'
      && ['meetCode', 'title', 'meetUrl'].every((key) => typeof (message.payload as Record<string, unknown>)[key] === 'string')
      && typeof (message.payload as Record<string, unknown>).now === 'number';
  }
  if (message.type === 'MEETING_SESSION') {
    return !!message.payload
      && typeof message.payload === 'object'
      && typeof (message.payload as Record<string, unknown>).meetingId === 'string'
      && typeof (message.payload as Record<string, unknown>).startedAt === 'number'
      && typeof (message.payload as Record<string, unknown>).resumed === 'boolean';
  }
  if (message.type === 'PONG_CONTENT_SCRIPT') {
    return !!message.payload
      && typeof message.payload === 'object'
      && typeof (message.payload as Record<string, unknown>).meetCode === 'string'
      && isMeetStateSignal((message.payload as Record<string, unknown>).signal);
  }
  if (isMeetStateSignal(message.type)) return message.payload === undefined;
  if (message.type === 'CONTENT_STATUS') {
    return !!message.payload
      && typeof message.payload === 'object'
      && isMeetStateSignal((message.payload as Record<string, unknown>).signal);
  }
  if (message.type === 'CAPTION_OBSERVATION') return isCaptionObservation(message.payload);
  if (message.type === 'TRANSCRIPT_SEGMENT') return isTranscriptSegment(message.payload);
  if (message.type === 'TRANSCRIPT_TURN') {
    return isTranscriptSegment(message.payload)
      && typeof (message.payload as unknown as Record<string, unknown>).finalized === 'boolean';
  }
  if (message.type === 'MEETING_SESSION') return isMeetingSession(message.payload);
  if (message.type === 'MEETING_STARTED') return isMeetingStarted(message.payload);
  if (message.type === 'SESSION_ENDED') {
    return !!message.payload
      && typeof message.payload === 'object'
      && typeof (message.payload as Record<string, unknown>).meetingId === 'string'
      && typeof (message.payload as Record<string, unknown>).endedAt === 'number';
  }
  return message.type === 'SESSION_STATUS' && isSignals(message.payload);
}
import type { RuntimeSession } from '../background/sessionManager';
import type { CaptionObservation, MeetStateSignal } from '../platforms/googleMeet/types';
import type { SpeakerTurn } from '../transcript/speakerTurn';
import type { TranscriptSegment } from '../transcript/types';

type TranscriptTurn = SpeakerTurn;

const isRuntimeSession = (value: unknown): value is RuntimeSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return typeof session.meetingId === 'string'
    && typeof session.meetCode === 'string'
    && typeof session.meetUrl === 'string'
    && typeof session.tabId === 'number'
    && typeof session.windowId === 'number'
    && typeof session.title === 'string'
    && typeof session.startedAt === 'number'
    && typeof session.lastSeenAt === 'number'
    && typeof session.reconnectCount === 'number'
    && (session.status === 'active' || session.status === 'disconnected' || session.status === 'ended');
};

const isContentScriptReady = (
  value: unknown,
): value is { meetCode: string; url: string; startedAt: number } => {
  if (!value || typeof value !== 'object') return false;
  const info = value as Record<string, unknown>;
  return typeof info.meetCode === 'string'
    && typeof info.url === 'string'
    && typeof info.startedAt === 'number';
};

const isRecentTurn = (value: unknown): boolean => {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const turn = value as Record<string, unknown>;
  return typeof turn.id === 'string'
    && typeof turn.speaker === 'string'
    && typeof turn.text === 'string'
    && typeof turn.endedAt === 'number';
};

const isMeetingSession = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return typeof session.meetingId === 'string'
    && typeof session.startedAt === 'number'
    && typeof session.resumed === 'boolean'
    && 'recentTurn' in session
    && isRecentTurn(session.recentTurn);
};

const isMeetingStarted = (
  value: unknown,
): value is { meetingId: string; title: string; meetUrl: string; startedAt: number } => {
  if (!value || typeof value !== 'object') return false;
  const info = value as Record<string, unknown>;
  return typeof info.meetingId === 'string'
    && typeof info.title === 'string'
    && typeof info.meetUrl === 'string'
    && typeof info.startedAt === 'number';
};

const isTranscriptSegment = (value: unknown): value is TranscriptSegment => {
  if (!value || typeof value !== 'object') return false;
  const segment = value as Record<string, unknown>;
  return typeof segment.id === 'string'
    && typeof segment.meetingId === 'string'
    && typeof segment.speaker === 'string'
    && typeof segment.text === 'string'
    && typeof segment.startedAt === 'number'
    && typeof segment.endedAt === 'number'
    && typeof segment.relativeStartMs === 'number';
};
