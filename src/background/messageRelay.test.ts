import { describe, expect, it } from 'vitest';
import { shouldRelaySessionUpdate } from './messageRelay';

const meetA = { id: 7, url: 'https://meet.google.com/aaa-bbbb-ccc' };
const meetB = { id: 8, url: 'https://meet.google.com/ddd-eeee-fff' };

describe('shouldRelaySessionUpdate', () => {
  it.each([
    'MEET_DETECTED',
    'CAPTIONS_WAITING',
    'CAPTIONS_ACTIVE',
    'CAPTIONS_INACTIVE',
    'TRANSCRIPT_TURN',
    'MEETING_STARTED',
    'CONTENT_SCRIPT_READY',
    'METADATA_UPDATE',
    'CAPTIONS_OFF',
    'SESSION_ENDED',
  ] as const)('relays %s from any Meet tab without requiring the active tab', (type) => {
    const message = type === 'TRANSCRIPT_TURN'
      ? {
        type,
        payload: {
          id: 't1', meetingId: 'meeting-A', speaker: 'Alief', text: 'Halo',
          startedAt: 1, endedAt: 2, relativeStartMs: 0, finalized: true,
        },
      }
      : type === 'MEET_DETECTED' || type === 'CAPTIONS_WAITING' || type === 'CAPTIONS_ACTIVE' || type === 'CAPTIONS_INACTIVE'
        ? { type, payload: { meetingId: 'meeting-A' } }
        : type === 'MEETING_STARTED'
          ? { type, payload: { meetingId: 'meeting-A', title: 'T', meetUrl: 'https://meet.google.com/a', startedAt: 1 } }
          : type === 'CONTENT_SCRIPT_READY'
            ? { type, payload: { meetCode: 'a', url: 'https://meet.google.com/a', startedAt: 1 } }
            : type === 'METADATA_UPDATE'
              ? { type, payload: { meetingId: 'meeting-A', title: 'T', quality: 3 } }
              : type === 'CAPTIONS_OFF'
                ? { type, payload: { meetingId: 'meeting-A', since: 1 } }
                : { type, payload: { meetingId: 'meeting-A', endedAt: 1 } };
    expect(shouldRelaySessionUpdate(message, meetA)).toBe(true);
    expect(shouldRelaySessionUpdate(message, meetB)).toBe(true);
  });

  it('does not relay heartbeats, requests, or non-Meet senders', () => {
    expect(shouldRelaySessionUpdate(
      { type: 'MEET_HEARTBEAT', payload: { meetingId: 'm', meetCode: 'c', timestamp: 1 } },
      meetA,
    )).toBe(false);
    expect(shouldRelaySessionUpdate({ type: 'GET_SESSION_STATUS' }, meetA)).toBe(false);
    expect(shouldRelaySessionUpdate(
      { type: 'TRANSCRIPT_TURN', payload: { id: 't1', meetingId: 'm', speaker: 'A', text: 'x', startedAt: 1, endedAt: 2, relativeStartMs: 0, finalized: true } },
      {},
    )).toBe(false);
    expect(shouldRelaySessionUpdate(
      { type: 'CAPTIONS_ACTIVE', payload: { meetingId: 'm' } },
      { id: 9, url: 'https://example.com' },
    )).toBe(false);
  });
});
