import { describe, expect, it, vi } from 'vitest';
import { createSequentialPoll } from './poll';

describe('createSequentialPoll', () => {
  it('does not overlap requests and runs a queued retry next', async () => {
    let finish!: () => void;
    let active = 0;
    let peak = 0;
    const task = vi.fn(() => new Promise<void>((resolve) => {
      active += 1;
      peak = Math.max(peak, active);
      finish = () => { active -= 1; resolve(); };
    }));
    const poll = createSequentialPoll(task, 60_000);

    poll.start();
    poll.retry();
    expect(task).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
    poll.stop();
    finish();
  });

  it('clears running state after rejection so retry can run', async () => {
    let finish!: () => void;
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const poll = createSequentialPoll(task, 60_000);

    poll.start();
    await Promise.resolve();
    await Promise.resolve();
    poll.retry();
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(2);
    poll.stop();
    finish();
  });
});
