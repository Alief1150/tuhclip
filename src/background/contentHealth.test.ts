import { describe, expect, it } from 'vitest';
import { createInjectionTracker, extractMeetCode, isMissingReceiverError } from './contentHealth';

describe('contentHealth', () => {
  it('detects the missing-receiver connection error', () => {
    expect(isMissingReceiverError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(true);
    expect(isMissingReceiverError(new Error('No tab with id: 99'))).toBe(false);
    expect(isMissingReceiverError(null)).toBe(false);
  });

  it('extracts the Meet code from the page path', () => {
    expect(extractMeetCode('/qsi-tjbe-obb')).toBe('qsi-tjbe-obb');
    expect(extractMeetCode('/landing')).toBe('');
  });

  it('injects a missing content script at most once per tab', () => {
    const tracker = createInjectionTracker();
    expect(tracker.shouldInject(7)).toBe(true);
    expect(tracker.shouldInject(7)).toBe(false);
    tracker.markFailed(7);
    expect(tracker.shouldInject(7)).toBe(true);
    tracker.markInjected(7);
    expect(tracker.shouldInject(7)).toBe(false);
  });
});
