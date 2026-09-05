import { describe, expect, it } from 'vitest';
import { resolveSessionStatus } from './sessionStatus';

describe('resolveSessionStatus', () => {
  it('does not contact content scripts outside Google Meet', async () => {
    let contacted = false;
    const status = await resolveSessionStatus({ id: 1, url: 'https://example.com' }, async () => {
      contacted = true;
      return { signal: 'CAPTIONS_WAITING' };
    });

    expect(status).toEqual({ onMeet: false, contentReady: false, lifecycle: 'waiting' });
    expect(contacted).toBe(false);
  });

  it('recovers readiness from the active document on every request', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async (tabId) => tabId === 7 ? { signal: 'CAPTIONS_ACTIVE' } : null,
    );

    expect(status).toEqual({ onMeet: true, contentReady: true, lifecycle: 'active' });
  });

  it('maps inactive captions to an ended lifecycle', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => ({ signal: 'CAPTIONS_INACTIVE' }),
    );
    expect(status).toEqual({ onMeet: true, contentReady: true, lifecycle: 'ended' });
  });

  it('reports Meet detected when the active document cannot respond', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => null,
    );

    expect(status).toEqual({ onMeet: true, contentReady: false, lifecycle: 'waiting' });
  });
});
