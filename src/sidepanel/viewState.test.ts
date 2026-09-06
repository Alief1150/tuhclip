import { describe, expect, it } from 'vitest';
import { deriveViewState } from './viewState';

describe('deriveViewState', () => {
  it.each([
    [{ onMeet: false, contentReady: false, contentMissing: false, lifecycle: 'waiting' }, 'not-on-meet'],
    [{ onMeet: true, contentReady: false, contentMissing: false, lifecycle: 'waiting' }, 'meet-detected'],
    [{ onMeet: true, contentReady: false, contentMissing: true, lifecycle: 'waiting' }, 'meet-detected'],
    [{ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'waiting' }, 'captions-off'],
    [{ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'active' }, 'transcribing'],
    [{ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'ended' }, 'idle'],
  ] as const)('maps session signals to %s', (signals, expected) => {
    expect(deriveViewState(signals)).toBe(expected);
  });
});
