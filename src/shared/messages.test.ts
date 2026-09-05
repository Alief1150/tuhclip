import { describe, expect, it } from 'vitest';
import { isRuntimeMessage } from './messages';

describe('isRuntimeMessage', () => {
  it('accepts a complete session status message', () => {
    expect(isRuntimeMessage({
      type: 'SESSION_STATUS',
      payload: { onMeet: true, contentReady: true, lifecycle: 'waiting' },
    })).toBe(true);
  });

  it('rejects malformed runtime data', () => {
    expect(isRuntimeMessage({ type: 'SESSION_STATUS', payload: { onMeet: true, contentReady: true, lifecycle: 'paused' } })).toBe(false);
    expect(isRuntimeMessage(null)).toBe(false);
  });

  it('accepts content status requests and lifecycle responses', () => {
    expect(isRuntimeMessage({ type: 'GET_CONTENT_STATUS' })).toBe(true);
    expect(isRuntimeMessage({ type: 'CONTENT_STATUS', payload: { signal: 'CAPTIONS_INACTIVE' } })).toBe(true);
  });

  it('accepts Meet state signals and caption observations but rejects malformed observations', () => {
    expect(isRuntimeMessage({ type: 'MEET_DETECTED' })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_WAITING' })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_ACTIVE' })).toBe(true);
    expect(isRuntimeMessage({ type: 'CAPTIONS_INACTIVE' })).toBe(true);
    expect(isRuntimeMessage({
      type: 'CAPTION_OBSERVATION',
      payload: { speaker: 'Unknown speaker', text: 'Hello', observedAt: 10, sourceId: 'a' },
    })).toBe(true);
    expect(isRuntimeMessage({
      type: 'CAPTION_OBSERVATION',
      payload: { speaker: 'Ada', text: '', observedAt: 'now' },
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
