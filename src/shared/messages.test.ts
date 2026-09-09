import { describe, expect, it } from 'vitest';
import { isRuntimeMessage } from './messages';

describe('isRuntimeMessage', () => {
  it('accepts a complete session status message', () => {
    expect(isRuntimeMessage({
      type: 'SESSION_STATUS',
      payload: { onMeet: true, contentReady: true, contentMissing: false, backgroundMeetingId: null, captionsOff: false, lifecycle: 'waiting' },
    })).toBe(true);
  });

  it('rejects malformed runtime data', () => {
    expect(isRuntimeMessage({ type: 'SESSION_STATUS', payload: { onMeet: true, contentReady: true, contentMissing: false, backgroundMeetingId: null, captionsOff: false, lifecycle: 'paused' } })).toBe(false);
    expect(isRuntimeMessage(null)).toBe(false);
  });

  it('accepts content status requests and lifecycle responses', () => {
    expect(isRuntimeMessage({ type: 'GET_CONTENT_STATUS' })).toBe(true);
    expect(isRuntimeMessage({ type: 'CONTENT_STATUS', payload: { signal: 'CAPTIONS_INACTIVE' } })).toBe(true);
  });

  it('accepts Meet state signals and caption observations but rejects malformed observations', () => {
    expect(isRuntimeMessage({ type: 'MEET_DETECTED', payload: { meetingId: 'meeting-A' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_WAITING', payload: { meetingId: 'meeting-A' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_ACTIVE', payload: { meetingId: 'meeting-A' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_INACTIVE', payload: { meetingId: 'meeting-A' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'MEET_DETECTED' })).toBe(false);
    expect(isRuntimeMessage({
      type: 'CAPTION_OBSERVATION',
      payload: { speaker: 'Unknown speaker', text: 'Hello', observedAt: 10, sourceId: 'a', meetingId: 'meeting-A' },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'CAPTION_OBSERVATION',
      payload: { speaker: 'Unknown speaker', text: 'Hello', observedAt: 10 },
    })).toBe(false);
    expect(isRuntimeMessage({
      type: 'CAPTION_OBSERVATION',
      payload: { speaker: 'Ada', text: '', observedAt: 'now' },
    })).toBe(false);
  });

  it('accepts active-tab sync requests and results', () => {
    expect(isRuntimeMessage({ type: 'SYNC_ACTIVE_TAB' })).toBe(true);
    expect(isRuntimeMessage({
      type: 'ACTIVE_TAB_SYNCED',
      payload: { session: null, contentAlive: false, healed: false },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'ACTIVE_TAB_SYNCED',
      payload: { session: { meetingId: 'x' }, contentAlive: true, healed: false },
    })).toBe(false);
  });

  it('accepts the content-script handshake and ping/pong pair', () => {
    expect(isRuntimeMessage({
      type: 'CONTENT_SCRIPT_READY',
      payload: { meetCode: 'abc-defg-hij', url: 'https://meet.google.com/abc-defg-hij', startedAt: 1 },
    })).toBe(true);
    expect(isRuntimeMessage({ type: 'PING_CONTENT_SCRIPT' })).toBe(true);
    expect(isRuntimeMessage({
      type: 'PONG_CONTENT_SCRIPT',
      payload: { meetCode: 'abc-defg-hij', signal: 'CAPTIONS_ACTIVE' },
    })).toBe(true);
    expect(isRuntimeMessage({ type: 'CONTENT_SCRIPT_READY', payload: { meetCode: 'x' } })).toBe(false);
    expect(isRuntimeMessage({
      type: 'PONG_CONTENT_SCRIPT',
      payload: { meetCode: 'x', signal: 'NOPE' },
    })).toBe(false);
  });

  it('accepts heartbeat and active-session messages with identity', () => {
    expect(isRuntimeMessage({
      type: 'MEET_HEARTBEAT',
      payload: { meetingId: 'meeting-A', meetCode: 'aaa-bbbb-ccc', timestamp: 1 },
    })).toBe(true);
    expect(isRuntimeMessage({ type: 'GET_ACTIVE_SESSIONS' })).toBe(true);
    expect(isRuntimeMessage({
      type: 'ACTIVE_SESSIONS',
      payload: { sessions: [{
        meetingId: 'meeting-A', meetCode: 'aaa-bbbb-ccc', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
        tabId: 101, windowId: 1, title: 'Kelas', startedAt: 1, lastSeenAt: 2, reconnectCount: 0, status: 'active', captionsOff: false,
      }] },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'ACTIVE_SESSIONS',
      payload: { sessions: [{ meetingId: 'meeting-A' }] },
    })).toBe(false);
  });

  it('accepts open-meeting-tab requests and results', () => {
    expect(isRuntimeMessage({ type: 'OPEN_MEETING_TAB', payload: { meetingId: 'meeting-A' } })).toBe(true);
    expect(isRuntimeMessage({ type: 'MEETING_TAB_OPENED', payload: { meetingId: 'meeting-A', ok: true } })).toBe(true);
    expect(isRuntimeMessage({ type: 'OPEN_MEETING_TAB', payload: {} })).toBe(false);
  });

  it('accepts captions-off signals with meeting identity', () => {
    expect(isRuntimeMessage({
      type: 'CAPTIONS_OFF',
      payload: { meetingId: 'meeting-A', since: 100 },
    })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_OFF', payload: { meetingId: 'meeting-A' } })).toBe(false);
  });

  it('accepts speaker-turn messages carrying a finalized flag', () => {
    expect(isRuntimeMessage({
      type: 'TRANSCRIPT_TURN',
      payload: {
        id: 'turn-1', meetingId: 'm1', speaker: 'Alief', text: 'Halo',
        startedAt: 1000, endedAt: 2000, relativeStartMs: 0, finalized: false,
      },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'TRANSCRIPT_TURN',
      payload: {
        id: 'turn-1', meetingId: 'm1', speaker: 'Alief', text: 'Halo',
        startedAt: 1000, endedAt: 2000, relativeStartMs: 0,
      },
    })).toBe(false);
  });

  it('accepts finalized transcript segments but rejects malformed ones', () => {
    expect(isRuntimeMessage({
      type: 'TRANSCRIPT_SEGMENT',
      payload: {
        id: 'seg-1', meetingId: 'm1', speaker: 'Alief', text: 'Halo',
        startedAt: 1000, endedAt: 2000, relativeStartMs: 0,
      },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'TRANSCRIPT_SEGMENT',
      payload: { id: 'seg-1', speaker: 'Alief', text: 'Halo' },
    })).toBe(false);
  });
});
