import { describe, expect, it } from 'vitest';
import { shouldRelayToExtension } from './messageRelay';

describe('shouldRelayToExtension', () => {
  it.each(['MEET_DETECTED', 'CAPTIONS_WAITING', 'CAPTIONS_ACTIVE', 'CAPTIONS_INACTIVE'] as const)(
    'relays the %s content-script signal',
    (type) => expect(shouldRelayToExtension(
      { type },
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
    )).toBe(true),
  );

  it('relays the content-script handshake from the active Meet tab', () => {
    expect(shouldRelayToExtension(
      { type: 'CONTENT_SCRIPT_READY', payload: { meetCode: 'abc-defg-hij', url: 'https://meet.google.com/abc-defg-hij', startedAt: 1 } },
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
    )).toBe(true);
  });

  it('does not relay observations or messages from extension pages', () => {
    expect(shouldRelayToExtension({ type: 'CAPTION_OBSERVATION', payload: { speaker: 'Ada', text: 'Hi', observedAt: 1 } }, { id: 7, url: 'https://meet.google.com/a' }, { id: 7, url: 'https://meet.google.com/a' })).toBe(false);
    expect(shouldRelayToExtension({ type: 'CAPTIONS_ACTIVE' }, {}, { id: 7, url: 'https://meet.google.com/a' })).toBe(false);
  });

  it('ignores Meet signals from inactive tabs and active non-Meet tabs', () => {
    expect(shouldRelayToExtension(
      { type: 'CAPTIONS_ACTIVE' },
      { id: 8, url: 'https://meet.google.com/inactive' },
      { id: 7, url: 'https://meet.google.com/active' },
    )).toBe(false);
    expect(shouldRelayToExtension(
      { type: 'CAPTIONS_ACTIVE' },
      { id: 8, url: 'https://meet.google.com/inactive' },
      { id: 8, url: 'https://example.com' },
    )).toBe(false);
  });
});
