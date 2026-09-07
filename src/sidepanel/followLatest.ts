export const FOLLOW_THRESHOLD_PX = 80;

export function isNearBottom(element: { scrollHeight: number; scrollTop: number; clientHeight: number }, thresholdPx = FOLLOW_THRESHOLD_PX): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= thresholdPx;
}

export interface FollowState {
  following: boolean;
  unseen: number;
}

interface MeetingFollow {
  following: boolean;
  unseenIds: Set<string>;
}

export class FollowTracker {
  private states = new Map<string, MeetingFollow>();

  private current(meetingId: string): MeetingFollow {
    let state = this.states.get(meetingId);
    if (!state) {
      state = { following: true, unseenIds: new Set() };
      this.states.set(meetingId, state);
    }
    return state;
  }

  forMeeting(meetingId: string): FollowState {
    const state = this.states.get(meetingId);
    if (!state) return { following: true, unseen: 0 };
    return { following: state.following, unseen: state.unseenIds.size };
  }

  onScroll(meetingId: string, atBottom: boolean): FollowState {
    const state = this.current(meetingId);
    if (atBottom) {
      state.following = true;
      state.unseenIds.clear();
    } else {
      state.following = false;
    }
    return { following: state.following, unseen: state.unseenIds.size };
  }

  onTurnChanged(meetingId: string, turnId: string): { shouldScroll: boolean; state: FollowState } {
    const state = this.current(meetingId);
    if (state.following) {
      state.unseenIds.clear();
      return { shouldScroll: true, state: { following: true, unseen: 0 } };
    }
    state.unseenIds.add(turnId);
    return { shouldScroll: false, state: { following: false, unseen: state.unseenIds.size } };
  }

  jumpToLatest(meetingId: string): FollowState {
    const state = this.current(meetingId);
    state.following = true;
    state.unseenIds.clear();
    return { following: true, unseen: 0 };
  }
}
