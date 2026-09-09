import type { SessionSignals } from '../shared/messages';
import type { MeetStateSignal } from '../platforms/googleMeet/types';
import { isMissingReceiverError } from './contentHealth';

type Tab = { id?: number; url?: string } | undefined;
type ReadContentStatus = (tabId: number) => Promise<{ signal: MeetStateSignal } | null>;
type ReadCaptionsOff = (tabId: number) => Promise<boolean>;
type ReadCcOn = (tabId: number) => Promise<boolean | null>;
type HealContentScript = (tabId: number) => Promise<void>;

const lifecycleBySignal = {
  MEET_DETECTED: 'waiting',
  CAPTIONS_WAITING: 'waiting',
  CAPTIONS_ACTIVE: 'active',
  CAPTIONS_INACTIVE: 'ended',
} as const;

const missing: SessionSignals = { onMeet: true, contentReady: false, contentMissing: true, backgroundMeetingId: null, captionsOff: false, ccOn: null, lifecycle: 'waiting' };

export async function resolveSessionStatus(
  tab: Tab,
  readContentStatus: ReadContentStatus,
  healContentScript: HealContentScript = async () => undefined,
  readCaptionsOff: ReadCaptionsOff = async () => false,
  readCcOn: ReadCcOn = async () => null,
): Promise<SessionSignals> {
  const onMeet = tab?.url?.startsWith('https://meet.google.com/') ?? false;
  if (!onMeet || tab?.id === undefined) {
    return { onMeet, contentReady: false, contentMissing: false, backgroundMeetingId: null, captionsOff: false, ccOn: null, lifecycle: 'waiting' };
  }

  try {
    const content = await readContentStatus(tab.id);
    if (!content) {
      return { onMeet: true, contentReady: false, contentMissing: false, backgroundMeetingId: null, captionsOff: false, ccOn: null, lifecycle: 'waiting' };
    }
    return {
      onMeet: true,
      contentReady: true,
      contentMissing: false,
      backgroundMeetingId: null,
      captionsOff: tab.id === undefined ? false : await readCaptionsOff(tab.id).catch(() => false),
      ccOn: tab.id === undefined ? null : await readCcOn(tab.id).catch(() => null),
      lifecycle: lifecycleBySignal[content.signal],
    };
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      return { onMeet: true, contentReady: false, contentMissing: false, backgroundMeetingId: null, captionsOff: false, ccOn: null, lifecycle: 'waiting' };
    }
    try {
      await healContentScript(tab.id);
      const content = await readContentStatus(tab.id);
      if (!content) return { ...missing, contentMissing: false };
      return {
        onMeet: true,
        contentReady: true,
        contentMissing: false,
        backgroundMeetingId: null,
        captionsOff: await readCaptionsOff(tab.id).catch(() => false),
        ccOn: await readCcOn(tab.id).catch(() => null),
        lifecycle: lifecycleBySignal[content.signal],
      };
    } catch {
      return missing;
    }
  }
}
