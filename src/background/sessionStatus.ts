import type { SessionSignals } from '../shared/messages';
import type { MeetStateSignal } from '../platforms/googleMeet/types';

type Tab = { id?: number; url?: string } | undefined;
type ReadContentStatus = (tabId: number) => Promise<{ signal: MeetStateSignal } | null>;

const lifecycleBySignal = {
  MEET_DETECTED: 'waiting',
  CAPTIONS_WAITING: 'waiting',
  CAPTIONS_ACTIVE: 'active',
  CAPTIONS_INACTIVE: 'ended',
} as const;

export async function resolveSessionStatus(tab: Tab, readContentStatus: ReadContentStatus): Promise<SessionSignals> {
  const onMeet = tab?.url?.startsWith('https://meet.google.com/') ?? false;
  if (!onMeet || tab?.id === undefined) {
    return { onMeet, contentReady: false, lifecycle: 'waiting' };
  }

  const content = await readContentStatus(tab.id);
  return {
    onMeet: true,
    contentReady: content !== null,
    lifecycle: content ? lifecycleBySignal[content.signal] : 'waiting',
  };
}
