export type SessionSignals = {
  onMeet: boolean;
  contentReady: boolean;
  contentMissing: boolean;
  lifecycle: MeetingLifecycle;
};

export type MeetingLifecycle = 'waiting' | 'active' | 'ended';

export type RuntimeMessage =
  | { type: 'GET_SESSION_STATUS' }
  | { type: 'GET_CONTENT_STATUS' }
  | { type: 'CONTENT_STATUS'; payload: { signal: MeetStateSignal } }
  | { type: 'CONTENT_SCRIPT_READY'; payload: { meetCode: string; url: string; startedAt: number } }
  | { type: 'PING_CONTENT_SCRIPT' }
  | { type: 'PONG_CONTENT_SCRIPT'; payload: { meetCode: string; signal: MeetStateSignal } }
  | { type: 'SESSION_STATUS'; payload: SessionSignals }
  | { type: MeetStateSignal }
  | { type: 'CAPTION_OBSERVATION'; payload: CaptionObservation }
  | { type: 'TRANSCRIPT_SEGMENT'; payload: TranscriptSegment }
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
    || message.type === 'PING_CONTENT_SCRIPT') {
    return message.payload === undefined;
  }
  if (message.type === 'CONTENT_SCRIPT_READY') return isContentScriptReady(message.payload);
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
  if (message.type === 'MEETING_STARTED') return isMeetingStarted(message.payload);
  return message.type === 'SESSION_STATUS' && isSignals(message.payload);
}
import type { CaptionObservation, MeetStateSignal } from '../platforms/googleMeet/types';
import type { TranscriptSegment } from '../transcript/types';

const isContentScriptReady = (
  value: unknown,
): value is { meetCode: string; url: string; startedAt: number } => {
  if (!value || typeof value !== 'object') return false;
  const info = value as Record<string, unknown>;
  return typeof info.meetCode === 'string'
    && typeof info.url === 'string'
    && typeof info.startedAt === 'number';
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
