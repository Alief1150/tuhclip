export function isMissingReceiverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.includes('Could not establish connection')
    || message.includes('Receiving end does not exist');
}

export function extractMeetCode(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : '';
}

export function createInjectionTracker() {
  const inFlight = new Set<number>();
  const injected = new Set<number>();
  return {
    shouldInject: (tabId: number): boolean => {
      if (inFlight.has(tabId) || injected.has(tabId)) return false;
      inFlight.add(tabId);
      return true;
    },
    markInjected: (tabId: number): void => {
      inFlight.delete(tabId);
      injected.add(tabId);
    },
    markFailed: (tabId: number): void => {
      inFlight.delete(tabId);
    },
  };
}

export type InjectionTracker = ReturnType<typeof createInjectionTracker>;
