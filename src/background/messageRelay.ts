import { isRuntimeMessage } from '../shared/messages';

const relaySignals = new Set(['MEET_DETECTED', 'CAPTIONS_WAITING', 'CAPTIONS_ACTIVE', 'CAPTIONS_INACTIVE', 'TRANSCRIPT_SEGMENT', 'MEETING_STARTED', 'CONTENT_SCRIPT_READY']);

type TabIdentity = { id?: number; url?: string };

export function shouldRelayToExtension(message: unknown, sender: TabIdentity, activeTab: TabIdentity | undefined): boolean {
  return sender.id !== undefined
    && sender.id === activeTab?.id
    && sender.url?.startsWith('https://meet.google.com/') === true
    && activeTab.url?.startsWith('https://meet.google.com/') === true
    && isRuntimeMessage(message)
    && relaySignals.has(message.type);
}
