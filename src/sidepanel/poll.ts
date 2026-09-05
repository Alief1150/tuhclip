export type SequentialPoll = { start: () => void; retry: () => void; stop: () => void };

export function createSequentialPoll(task: () => Promise<void>, delay: number): SequentialPoll {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let running = false;
  let queued = false;
  let stopped = true;

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await task();
    } catch {
      // The polling task owns user-facing error reporting; polling remains retryable.
    } finally {
      running = false;
      if (stopped) return;
      if (queued) {
        queued = false;
        void run();
      } else {
        timer = globalThis.setTimeout(run, delay);
      }
    }
  };

  return {
    start: () => {
      stopped = false;
      void run();
    },
    retry: () => {
      if (running) {
        queued = true;
        return;
      }
      if (timer !== undefined) globalThis.clearTimeout(timer);
      void run();
    },
    stop: () => {
      stopped = true;
      queued = false;
      if (timer !== undefined) globalThis.clearTimeout(timer);
    },
  };
}
