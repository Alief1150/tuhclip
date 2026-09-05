import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { resolveSessionStatus } from './sessionStatus';
import { shouldRelayToExtension } from './messageRelay';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (!isRuntimeMessage(raw)) return false;

  if (sender.tab && (raw.type === 'MEET_DETECTED' || raw.type === 'CAPTIONS_WAITING' || raw.type === 'CAPTIONS_ACTIVE' || raw.type === 'CAPTIONS_INACTIVE' || raw.type === 'TRANSCRIPT_SEGMENT' || raw.type === 'MEETING_STARTED')) {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
      if (shouldRelayToExtension(raw, sender.tab ?? {}, activeTab)) {
        return chrome.runtime.sendMessage(raw);
      }
    }).catch(() => undefined);
    return false;
  }

  if (raw.type !== 'GET_SESSION_STATUS') return false;

  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    return resolveSessionStatus(tab, async (tabId) => {
      try {
        const response: unknown = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTENT_STATUS' } satisfies RuntimeMessage);
        return isRuntimeMessage(response) && response.type === 'CONTENT_STATUS' ? response.payload : null;
      } catch {
        return null;
      }
    });
  }).then((payload) => {
    sendResponse({ type: 'SESSION_STATUS', payload } satisfies RuntimeMessage);
  });
  return true;
});
