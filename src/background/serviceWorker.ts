import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';
import { getOrResumeMeeting } from '../storage/meetings';
import { createInjectionTracker, isMissingReceiverError } from './contentHealth';
import { shouldRelayToExtension } from './messageRelay';
import { resolveSessionStatus } from './sessionStatus';

const logger = createLogger('background');
const injections = createInjectionTracker();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

async function readContentStatus(tabId: number) {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, { type: 'GET_CONTENT_STATUS' } satisfies RuntimeMessage);
    return isRuntimeMessage(response) && response.type === 'CONTENT_STATUS' ? response.payload : null;
  } catch (error) {
    if (isMissingReceiverError(error)) throw error;
    logger.debug('Content status unreadable', error);
    return null;
  }
}

async function healContentScript(tabId: number): Promise<void> {
  if (!injections.shouldInject(tabId)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['assets/content.js'] });
    injections.markInjected(tabId);
    logger.debug('Content script injected into tab', tabId);
  } catch (error) {
    injections.markFailed(tabId);
    logger.debug('Content script injection failed', error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  if (!isRuntimeMessage(raw)) return false;

  if (sender.tab && (raw.type === 'MEET_DETECTED' || raw.type === 'CAPTIONS_WAITING' || raw.type === 'CAPTIONS_ACTIVE' || raw.type === 'CAPTIONS_INACTIVE' || raw.type === 'TRANSCRIPT_SEGMENT' || raw.type === 'MEETING_STARTED' || raw.type === 'CONTENT_SCRIPT_READY')) {
    logger.debug('Message arrived from Meet tab', raw.type);
    chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
      if (shouldRelayToExtension(raw, sender.tab ?? {}, activeTab)) {
        return chrome.runtime.sendMessage(raw);
      }
    }).catch(() => undefined);
    return false;
  }

  if (raw.type === 'GET_OR_RESUME_MEETING_SESSION') {
    getOrResumeMeeting(raw.payload.meetCode, {
      title: raw.payload.title,
      meetUrl: raw.payload.meetUrl,
    }, raw.payload.now).then(({ meeting, resumed }) => {
      sendResponse({
        type: 'MEETING_SESSION',
        payload: { meetingId: meeting.id, startedAt: meeting.startedAt, resumed },
      } satisfies RuntimeMessage);
    }).catch((error) => {
      logger.debug('Meeting session resume failed', error);
      sendResponse({
        type: 'MEETING_SESSION',
        payload: { meetingId: `meet-${Date.now().toString(36)}`, startedAt: Date.now(), resumed: false },
      } satisfies RuntimeMessage);
    });
    return true;
  }

  if (raw.type !== 'GET_SESSION_STATUS') return false;

  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    return resolveSessionStatus(tab, readContentStatus, healContentScript);
  }).then((payload) => {
    sendResponse({ type: 'SESSION_STATUS', payload } satisfies RuntimeMessage);
  });
  return true;
});
