import { describe, expect, it } from 'vitest';
import { FollowTracker, FOLLOW_THRESHOLD_PX, isNearBottom } from './followLatest';

describe('smart follow latest', () => {
  it('follows latest when at bottom and a new transcript arrives', () => {
    const tracker = new FollowTracker();
    const { shouldScroll, state } = tracker.onTurnChanged('m1', 'turn-1');
    expect(shouldScroll).toBe(true);
    expect(state).toEqual({ following: true, unseen: 0 });
  });

  it('holds the viewport and counts unique turns when scrolled up', () => {
    const tracker = new FollowTracker();
    tracker.onScroll('m1', false);
    const first = tracker.onTurnChanged('m1', 'turn-1');
    const second = tracker.onTurnChanged('m1', 'turn-2');
    expect(first.shouldScroll).toBe(false);
    expect(second.shouldScroll).toBe(false);
    expect(second.state).toEqual({ following: false, unseen: 2 });
  });

  it('counts one turn updated many times as a single unseen item', () => {
    const tracker = new FollowTracker();
    tracker.onScroll('m1', false);
    let state = tracker.forMeeting('m1');
    for (let i = 0; i < 20; i += 1) {
      state = tracker.onTurnChanged('m1', 'turn-1').state;
    }
    expect(state).toEqual({ following: false, unseen: 1 });
  });

  it('activates the latest control when an existing turn updates while scrolled up', () => {
    const tracker = new FollowTracker();
    tracker.onTurnChanged('m1', 'turn-1');
    tracker.onScroll('m1', false);
    const { shouldScroll, state } = tracker.onTurnChanged('m1', 'turn-1');
    expect(shouldScroll).toBe(false);
    expect(state).toEqual({ following: false, unseen: 1 });
  });

  it('clicking latest scrolls to bottom, clears count, and re-enables follow', () => {
    const tracker = new FollowTracker();
    tracker.onScroll('m1', false);
    tracker.onTurnChanged('m1', 'turn-1');
    tracker.onTurnChanged('m1', 'turn-2');
    expect(tracker.jumpToLatest('m1')).toEqual({ following: true, unseen: 0 });
  });

  it('returning near the bottom resumes follow and clears stale count', () => {
    const tracker = new FollowTracker();
    tracker.onScroll('m1', false);
    tracker.onTurnChanged('m1', 'turn-1');
    expect(tracker.onScroll('m1', true)).toEqual({ following: true, unseen: 0 });
  });

  it('keeps follow and count state isolated per meeting', () => {
    const tracker = new FollowTracker();
    tracker.onScroll('m1', false);
    tracker.onTurnChanged('m1', 'turn-1');
    tracker.onTurnChanged('m1', 'turn-1');
    expect(tracker.forMeeting('m2')).toEqual({ following: true, unseen: 0 });
    expect(tracker.forMeeting('m1')).toEqual({ following: false, unseen: 1 });
  });

  it('treats viewports within the near-bottom threshold as at bottom', () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 900, clientHeight: 100 - FOLLOW_THRESHOLD_PX + 10 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 100, clientHeight: 100 })).toBe(false);
  });
});
