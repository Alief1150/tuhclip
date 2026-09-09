import { isRuntimeMessage } from '../shared/messages';

const relaySignals = new Set([
  'MEET_DETECTED',
  'CAPTIONS_WAITING',
  'CAPTIONS_ACTIVE',
  'CAPTIONS_INACTIVE',
  'TRANSCRIPT_SEGMENT',
  'TRANSCRIPT_TURN',
  'MEETING_STARTED',
  'CONTENT_SCRIPT_READY',
  'METADATA_UPDATE',
  'CAPTIONS_OFF',
  'SESSION_ENDED',
]);

const noRelay = new Set([
  'MEET_HEARTBEAT',
  'GET_SESSION_STATUS',
  'GET_CONTENT_STATUS',
  'GET_ACTIVE_SESSIONS',
  'GET_OR_RESUME_MEETING_SESSION',
  'OPEN_MEETING_TAB',
  'PING_CONTENT_SCRIPT',
]);

type TabIdentity = { id?: number; url?: string };

function isMeetTab(tab: TabIdentity): boolean {
  return tab.url?.startsWith('https://meet.google.com/') === true;
}

export function shouldRelaySessionUpdate(message: unknown, sender: TabIdentity): boolean {
  if (sender.id === undefined || !isMeetTab(sender)) return false;
  if (!isRuntimeMessage(message)) return false;
  if (noRelay.has(message.type)) return false;
  return relaySignals.has(message.type);
}
