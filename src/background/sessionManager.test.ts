import { describe, expect, it } from 'vitest';
import { SessionManager } from './sessionManager';

const heartbeatA = (overrides: Partial<Record<string, number | string>> = {}) => ({
  meetingId: 'meeting-A',
  meetCode: 'aaa-bbbb-ccc',
  meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
  title: 'Kelas Jaringan',
  tabId: 101,
  windowId: 1,
  now: 1000,
  ...overrides,
});

const heartbeatB = (overrides: Partial<Record<string, number | string>> = {}) => ({
  meetingId: 'meeting-B',
  meetCode: 'ddd-eeee-fff',
  meetUrl: 'https://meet.google.com/ddd-eeee-fff',
  title: 'Weekly Team Meeting',
  tabId: 202,
  windowId: 1,
  now: 1000,
  ...overrides,
});

describe('SessionManager', () => {
  it('tracks two simultaneous meetings without contamination', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.registerOrHeartbeat(heartbeatB());
    expect(manager.getActive().map((session) => session.meetingId)).toEqual(['meeting-A', 'meeting-B']);
    expect(manager.get('meeting-A')?.tabId).toBe(101);
    expect(manager.get('meeting-B')?.tabId).toBe(202);
  });

  it('heartbeat refreshes liveness without duplicating the session', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.registerOrHeartbeat(heartbeatA({ now: 2000 }));
    expect(manager.getActive()).toHaveLength(1);
    expect(manager.get('meeting-A')?.lastSeenAt).toBe(2000);
    expect(manager.get('meeting-A')?.reconnectCount).toBe(0);
  });

  it('disconnecting one meeting leaves the other active', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.registerOrHeartbeat(heartbeatB());
    manager.markDisconnected('meeting-A', 2000);
    expect(manager.get('meeting-A')?.status).toBe('disconnected');
    expect(manager.getActive().map((session) => session.meetingId)).toEqual(['meeting-B']);
  });

  it('a heartbeat after disconnect reconnects the same session', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.markDisconnected('meeting-A', 2000);
    const session = manager.registerOrHeartbeat(heartbeatA({ now: 3000 }));
    expect(session.status).toBe('active');
    expect(session.reconnectCount).toBe(1);
    expect(session.disconnectedAt).toBeUndefined();
  });

  it('ended sessions leave the active set but stay queryable', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.markEnded('meeting-A', 2000);
    expect(manager.getActive()).toHaveLength(0);
    expect(manager.get('meeting-A')?.status).toBe('ended');
  });

  it('ends disconnected sessions only after the resume window expires', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.markDisconnected('meeting-A', 1000);
    expect(manager.sweepStale(1000 + 60_000, 10 * 60_000)).toEqual([]);
    expect(manager.get('meeting-A')?.status).toBe('disconnected');
    expect(manager.sweepStale(1000 + 11 * 60_000, 10 * 60_000)).toEqual(['meeting-A']);
    expect(manager.get('meeting-A')?.status).toBe('ended');
  });

  it('resolves the tab target only for sessions with a known tab', () => {
    const manager = new SessionManager();
    expect(manager.resolveMeetingTab('missing')).toBeNull();
    manager.registerOrHeartbeat(heartbeatA());
    expect(manager.resolveMeetingTab('meeting-A')).toEqual({ tabId: 101, windowId: 1 });
    manager.registerOrHeartbeat(heartbeatA({ tabId: -1, windowId: -1 }));
    expect(manager.resolveMeetingTab('meeting-A')).toBeNull();
  });

  it('tracks captions-off per session without touching others', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.registerOrHeartbeat(heartbeatB());
    manager.setCaptionsOff('meeting-A', true);
    expect(manager.get('meeting-A')?.captionsOff).toBe(true);
    expect(manager.get('meeting-B')?.captionsOff).toBe(false);
    expect(manager.getByTab(101)?.meetingId).toBe('meeting-A');
    expect(manager.getByTab(999)).toBeNull();
    manager.setCaptionsOff('meeting-A', false);
    expect(manager.get('meeting-A')?.captionsOff).toBe(false);
  });

  it('tracks CC state per session and clears captions-off when CC returns', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat({
      meetingId: 'meeting-A', meetCode: 'aaa-bbbb-ccc', meetUrl: 'https://meet.google.com/aaa-bbbb-ccc',
      title: 'Kelas', tabId: 101, windowId: 1, now: 1000,
    });
    manager.setCcOn('meeting-A', false);
    expect(manager.get('meeting-A')?.ccOn).toBe(false);
    manager.setCcOn('meeting-A', true);
    expect(manager.get('meeting-A')?.ccOn).toBe(true);
    expect(manager.get('meeting-A')?.captionsOff).toBe(false);
  });

  it('prunes only old ended sessions', () => {
    const manager = new SessionManager();
    manager.registerOrHeartbeat(heartbeatA());
    manager.registerOrHeartbeat(heartbeatB());
    manager.markEnded('meeting-A', 1000);
    manager.prune(1000 + 60_000, 30_000);
    expect(manager.get('meeting-A')).toBeNull();
    expect(manager.get('meeting-B')).not.toBeNull();
  });
});
