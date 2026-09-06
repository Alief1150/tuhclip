export const FOLLOW_THRESHOLD_PX = 80;

export function isNearBottom(element: { scrollHeight: number; scrollTop: number; clientHeight: number }, thresholdPx = FOLLOW_THRESHOLD_PX): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= thresholdPx;
}

export interface FollowState {
  following: boolean;
  unseen: number;
}

export class FollowTracker {
  private states = new Map<string, FollowState>();

  forMeeting(meetingId: string): FollowState {
    const existing = this.states.get(meetingId);
    if (existing) return { ...existing };
    return { following: true, unseen: 0 };
  }

  onScroll(meetingId: string, atBottom: boolean): FollowState {
    const next: FollowState = atBottom
      ? { following: true, unseen: 0 }
      : { following: false, unseen: this.states.get(meetingId)?.unseen ?? 0 };
    this.states.set(meetingId, next);
    return { ...next };
  }

  onNewItems(meetingId: string, count: number): { shouldScroll: boolean; state: FollowState } {
    const current = this.states.get(meetingId) ?? { following: true, unseen: 0 };
    if (current.following) {
      const next = { following: true, unseen: 0 };
      this.states.set(meetingId, next);
      return { shouldScroll: true, state: { ...next } };
    }
    const next = { following: false, unseen: current.unseen + count };
    this.states.set(meetingId, next);
    return { shouldScroll: false, state: { ...next } };
  }

  jumpToLatest(meetingId: string): FollowState {
    const next: FollowState = { following: true, unseen: 0 };
    this.states.set(meetingId, next);
    return { ...next };
  }
}
