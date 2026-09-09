export type RuntimeSessionStatus = 'active' | 'disconnected' | 'ended';

export interface RuntimeSession {
  meetingId: string;
  meetCode: string;
  meetUrl: string;
  tabId: number;
  windowId: number;
  title: string;
  startedAt: number;
  lastSeenAt: number;
  disconnectedAt?: number;
  reconnectCount: number;
  status: RuntimeSessionStatus;
  captionsOff: boolean;
  ccOn: boolean | null;
}

export interface Heartbeat {
  meetingId: string;
  meetCode: string;
  meetUrl: string;
  title: string;
  tabId: number;
  windowId: number;
  now: number;
}

export class SessionManager {
  private sessions = new Map<string, RuntimeSession>();

  registerOrHeartbeat(heartbeat: Heartbeat): RuntimeSession {
    const existing = this.sessions.get(heartbeat.meetingId);
    if (existing && existing.status !== 'ended') {
      existing.meetCode = heartbeat.meetCode || existing.meetCode;
      existing.meetUrl = heartbeat.meetUrl || existing.meetUrl;
      existing.title = heartbeat.title || existing.title;
      existing.tabId = heartbeat.tabId;
      existing.windowId = heartbeat.windowId;
      existing.lastSeenAt = heartbeat.now;
      if (existing.status === 'disconnected') {
        existing.status = 'active';
        existing.reconnectCount += 1;
        delete existing.disconnectedAt;
      }
      return { ...existing };
    }
    const session: RuntimeSession = {
      meetingId: heartbeat.meetingId,
      meetCode: heartbeat.meetCode,
      meetUrl: heartbeat.meetUrl,
      tabId: heartbeat.tabId,
      windowId: heartbeat.windowId,
      title: heartbeat.title,
      startedAt: heartbeat.now,
      lastSeenAt: heartbeat.now,
      reconnectCount: 0,
      status: 'active',
      captionsOff: false,
      ccOn: null,
    };
    this.sessions.set(heartbeat.meetingId, session);
    return { ...session };
  }

  markDisconnected(meetingId: string, now: number): void {
    const session = this.sessions.get(meetingId);
    if (!session || session.status !== 'active') return;
    session.status = 'disconnected';
    session.disconnectedAt = now;
  }

  markEnded(meetingId: string, now: number): void {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    session.status = 'ended';
    session.lastSeenAt = now;
  }

  get(meetingId: string): RuntimeSession | null {
    const session = this.sessions.get(meetingId);
    return session ? { ...session } : null;
  }

  getByTab(tabId: number): RuntimeSession | null {
    for (const session of this.sessions.values()) {
      if (session.tabId === tabId) return { ...session };
    }
    return null;
  }

  setCaptionsOff(meetingId: string, off: boolean): void {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    session.captionsOff = off;
  }

  setCcOn(meetingId: string, ccOn: boolean): void {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    session.ccOn = ccOn;
    if (ccOn) session.captionsOff = false;
  }

  resolveMeetingTab(meetingId: string): { tabId: number; windowId: number } | null {
    const session = this.sessions.get(meetingId);
    if (!session || session.tabId < 0) return null;
    return { tabId: session.tabId, windowId: session.windowId };
  }

  getActive(): RuntimeSession[] {
    return [...this.sessions.values()]
      .filter((session) => session.status === 'active')
      .map((session) => ({ ...session }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  getAll(): RuntimeSession[] {
    return [...this.sessions.values()]
      .map((session) => ({ ...session }))
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  prune(now: number, maxAgeMs: number): void {
    for (const [id, session] of this.sessions) {
      if (session.status === 'ended' && now - session.lastSeenAt > maxAgeMs) {
        this.sessions.delete(id);
      }
    }
  }

  sweepStale(now: number, resumeWindowMs: number): string[] {
    const newlyEnded: string[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === 'disconnected'
        && session.disconnectedAt !== undefined
        && now - session.disconnectedAt > resumeWindowMs) {
        session.status = 'ended';
        session.lastSeenAt = now;
        newlyEnded.push(session.meetingId);
      }
    }
    return newlyEnded;
  }
}
