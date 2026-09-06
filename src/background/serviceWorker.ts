import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { createLogger } from '../shared/logger';
import { SESSION_RESUME_WINDOW_MS, createMeeting, endMeeting, getOrResumeMeeting, meetCodeFromUrl, meetingTitleFallback } from '../storage/meetings';
import { upsertSegment } from '../storage/segments';
import { createInjectionTracker, extractMeetCode, isMissingReceiverError } from './contentHealth';
import { shouldRelayToExtension } from './messageRelay';
import { SessionManager } from './sessionManager';
import { resolveSessionStatus } from './sessionStatus';

const logger = createLogger('background');
const injections = createInjectionTracker();
const sessions = new SessionManager();
let lastBackgroundTurn: { meetingId: string; at: number } | null = null;

const BACKGROUND_RECENT_MS = 5 * 60 * 1000;

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

  if (sender.tab && (raw.type === 'MEET_DETECTED' || raw.type === 'CAPTIONS_WAITING' || raw.type === 'CAPTIONS_ACTIVE' || raw.type === 'CAPTIONS_INACTIVE' || raw.type === 'TRANSCRIPT_SEGMENT' || raw.type === 'TRANSCRIPT_TURN' || raw.type === 'MEETING_STARTED' || raw.type === 'CONTENT_SCRIPT_READY' || raw.type === 'SESSION_ENDED' || raw.type === 'MEET_HEARTBEAT' || raw.type === 'CAPTIONS_OFF')) {
    logger.debug('Message arrived from Meet tab', raw.type);
    if (raw.type === 'TRANSCRIPT_SEGMENT' || raw.type === 'TRANSCRIPT_TURN') {
      lastBackgroundTurn = { meetingId: raw.payload.meetingId, at: Date.now() };
      void upsertSegment(raw.payload).catch((error) => logger.debug('Background persist failed', error));
    }
    if (raw.type === 'MEETING_STARTED') {
      sessions.registerOrHeartbeat({
        meetingId: raw.payload.meetingId,
        meetCode: extractMeetCode(new URL(raw.payload.meetUrl).pathname),
        meetUrl: raw.payload.meetUrl,
        title: raw.payload.title,
        tabId: sender.tab?.id ?? -1,
        windowId: sender.tab?.windowId ?? -1,
        now: Date.now(),
      });
    }
    if (raw.type === 'CONTENT_SCRIPT_READY') {
      sessions.registerOrHeartbeat({
        meetingId: `meet-${raw.payload.meetCode || 'unknown'}`,
        meetCode: raw.payload.meetCode,
        meetUrl: raw.payload.url,
        title: '',
        tabId: sender.tab?.id ?? -1,
        windowId: sender.tab?.windowId ?? -1,
        now: Date.now(),
      });
    }
    if (raw.type === 'MEETING_STARTED') {
      lastBackgroundTurn = { meetingId: raw.payload.meetingId, at: Date.now() };
      void createMeeting({
        id: raw.payload.meetingId,
        title: raw.payload.title.trim() || meetingTitleFallback(raw.payload.startedAt, meetCodeFromUrl(raw.payload.meetUrl)),
        meetUrl: raw.payload.meetUrl,
        startedAt: raw.payload.startedAt,
        createdAt: Date.now(),
      }).catch((error) => logger.debug('Background meeting create failed', error));
    }
    if (raw.type === 'SESSION_ENDED') {
      void endMeeting(raw.payload.meetingId, raw.payload.endedAt).catch((error) => logger.debug('Background meeting end failed', error));
      sessions.markDisconnected(raw.payload.meetingId, raw.payload.endedAt);
    }
    if (raw.type === 'CAPTIONS_OFF') {
      sessions.setCaptionsOff(raw.payload.meetingId, true);
    }
    if (raw.type === 'CAPTIONS_ACTIVE' && sender.tab?.id !== undefined) {
      const session = sessions.getByTab(sender.tab.id);
      if (session) sessions.setCaptionsOff(session.meetingId, false);
    }
    if (raw.type === 'MEET_HEARTBEAT') {
      sessions.registerOrHeartbeat({
        meetingId: raw.payload.meetingId,
        meetCode: raw.payload.meetCode,
        meetUrl: sender.tab?.url ?? '',
        title: sessions.get(raw.payload.meetingId)?.title ?? '',
        tabId: sender.tab?.id ?? -1,
        windowId: sender.tab?.windowId ?? -1,
        now: raw.payload.timestamp,
      });
      return false;
    }
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
    }, raw.payload.now).then(({ meeting, resumed, recentTurn }) => {
      sendResponse({
        type: 'MEETING_SESSION',
        payload: { meetingId: meeting.id, startedAt: meeting.startedAt, resumed, recentTurn },
      } satisfies RuntimeMessage);
    }).catch((error) => {
      logger.debug('Meeting session resume failed', error);
      sendResponse({
        type: 'MEETING_SESSION',
        payload: { meetingId: `meet-${Date.now().toString(36)}`, startedAt: Date.now(), resumed: false, recentTurn: null },
      } satisfies RuntimeMessage);
    });
    return true;
  }

  if (raw.type === 'GET_ACTIVE_SESSIONS') {
    const ended = sessions.sweepStale(Date.now(), SESSION_RESUME_WINDOW_MS);
    for (const meetingId of ended) {
      void endMeeting(meetingId, Date.now()).catch((error) => logger.debug('Background meeting end failed', error));
    }
    sendResponse({ type: 'ACTIVE_SESSIONS', payload: { sessions: sessions.getActive() } } satisfies RuntimeMessage);
    return false;
  }

  if (raw.type === 'OPEN_MEETING_TAB') {
    const target = sessions.resolveMeetingTab(raw.payload.meetingId);
    if (!target) {
      sendResponse({ type: 'MEETING_TAB_OPENED', payload: { meetingId: raw.payload.meetingId, ok: false } } satisfies RuntimeMessage);
      return false;
    }
    chrome.tabs.get(target.tabId).then((tab) => {
      if (!tab) throw new Error('tab gone');
      return chrome.tabs.update(target.tabId, { active: true }).then(() => {
        if (tab.windowId !== undefined) {
          return chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
        }
      });
    }).then(() => {
      sendResponse({ type: 'MEETING_TAB_OPENED', payload: { meetingId: raw.payload.meetingId, ok: true } } satisfies RuntimeMessage);
    }).catch((error) => {
      logger.debug('Open meeting tab failed', error);
      sessions.markDisconnected(raw.payload.meetingId, Date.now());
      sendResponse({ type: 'MEETING_TAB_OPENED', payload: { meetingId: raw.payload.meetingId, ok: false } } satisfies RuntimeMessage);
    });
    return true;
  }

  if (raw.type !== 'GET_SESSION_STATUS') return false;

  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    return resolveSessionStatus(tab, readContentStatus, healContentScript, async (tabId) => {
      return sessions.getByTab(tabId)?.captionsOff ?? false;
    });
  }).then((payload) => {
    const backgroundMeetingId = lastBackgroundTurn && Date.now() - lastBackgroundTurn.at <= BACKGROUND_RECENT_MS
      ? lastBackgroundTurn.meetingId
      : null;
    sendResponse({ type: 'SESSION_STATUS', payload: { ...payload, backgroundMeetingId } } satisfies RuntimeMessage);
  });
  return true;
});
