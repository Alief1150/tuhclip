import { describe, expect, it } from 'vitest';
import { resolveSessionStatus } from './sessionStatus';

describe('resolveSessionStatus', () => {
  it('does not contact content scripts outside Google Meet', async () => {
    let contacted = false;
    const status = await resolveSessionStatus({ id: 1, url: 'https://example.com' }, async () => {
      contacted = true;
      return { signal: 'CAPTIONS_WAITING' };
    });

    expect(status).toEqual({ onMeet: false, contentReady: false, contentMissing: false, lifecycle: 'waiting' });
    expect(contacted).toBe(false);
  });

  it('recovers readiness from the active document on every request', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async (tabId) => tabId === 7 ? { signal: 'CAPTIONS_ACTIVE' } : null,
    );

    expect(status).toEqual({ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'active' });
  });

  it('maps inactive captions to an ended lifecycle', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => ({ signal: 'CAPTIONS_INACTIVE' }),
    );
    expect(status).toEqual({ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'ended' });
  });

  it('reports Meet detected when the active document cannot respond', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => null,
    );

    expect(status).toEqual({ onMeet: true, contentReady: false, contentMissing: false, lifecycle: 'waiting' });
  });

  it('self-heals a missing content script by injecting once and re-reading', async () => {
    let reads = 0;
    let heals = 0;
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => {
        reads += 1;
        if (reads === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
        return { signal: 'CAPTIONS_WAITING' };
      },
      async () => {
        heals += 1;
      },
    );

    expect(heals).toBe(1);
    expect(status).toEqual({ onMeet: true, contentReady: true, contentMissing: false, lifecycle: 'waiting' });
  });

  it('reports content missing when healing fails', async () => {
    const status = await resolveSessionStatus(
      { id: 7, url: 'https://meet.google.com/abc-defg-hij' },
      async () => {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      },
      async () => {
        throw new Error('injection denied');
      },
    );

    expect(status).toEqual({ onMeet: true, contentReady: false, contentMissing: true, lifecycle: 'waiting' });
  });
});
