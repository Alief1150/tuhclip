import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { extractMeetCode } from '../background/contentHealth';
import { createCaptionObserver } from '../platforms/googleMeet/captionObserver';
import type { MeetStateSignal } from '../platforms/googleMeet/types';
import { createLogger } from '../shared/logger';
import { TranscriptEngine } from '../transcript/transcriptEngine';
import { SpeakerTurnAggregator, type SpeakerTurn } from '../transcript/speakerTurn';
import type { TranscriptSegment } from '../transcript/types';

declare global {
  interface Window {
    __tuhclipContentInitialized?: boolean;
  }
}

const bootLogger = createLogger('content');

if (window.__tuhclipContentInitialized) {
  bootLogger.info('duplicate content script instance ignored');
} else {
  window.__tuhclipContentInitialized = true;
  void init().catch((cause) => bootLogger.info('content script init failed', cause));
}

function safeSend(message: RuntimeMessage): void {
  try {
    chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    bootLogger.info('extension context unavailable, message dropped');
  }
}

function pageTitle(): string {
  const title = document.title.trim().replace(/\s*-\s*Google Meet\s*$/i, '').trim();
  return title && title.toLowerCase() !== 'meet' ? title : '';
}

async function requestSession(meetCode: string): Promise<{ meetingId: string; meetingStart: number }> {
  const fallback = { meetingId: `meet-${Date.now().toString(36)}`, meetingStart: Date.now() };
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: 'GET_OR_RESUME_MEETING_SESSION',
      payload: { meetCode, title: pageTitle(), meetUrl: location.href, now: Date.now() },
    } satisfies RuntimeMessage);
    if (isRuntimeMessage(response) && response.type === 'MEETING_SESSION') {
      return { meetingId: response.payload.meetingId, meetingStart: response.payload.startedAt };
    }
  } catch {
    bootLogger.info('session request failed, using local meeting');
  }
  return fallback;
}

async function init(): Promise<void> {
  const logger = createLogger('caption');
  const transcriptLogger = createLogger('transcript');
  const meetCode = extractMeetCode(location.pathname);
  bootLogger.info('initialized');
  bootLogger.info('meet code:', meetCode || '(none)');

  const { meetingId, meetingStart } = await requestSession(meetCode);
  const engine = new TranscriptEngine({ meetingId, meetingStart });
  const turns = new SpeakerTurnAggregator({ meetingId, meetingStart });
  let signal: MeetStateSignal = 'MEET_DETECTED';
  let meetingAnnounced = false;

  const emitTurn = (turn: SpeakerTurn) => {
    transcriptLogger.debug(turn.finalized ? 'Turn finalized' : 'Turn updated', turn.speaker, turn.text);
    safeSend({ type: 'TRANSCRIPT_TURN', payload: turn });
  };

  const absorbChunk = (chunk: TranscriptSegment | null) => {
    if (!chunk) return;
    const result = turns.ingestChunk(chunk);
    emitTurn(result.turn);
  };

  const announceMeeting = () => {
    if (meetingAnnounced) return;
    meetingAnnounced = true;
    safeSend({
      type: 'MEETING_STARTED',
      payload: { meetingId, title: pageTitle(), meetUrl: location.href, startedAt: meetingStart },
    });
  };

  const flushFinalized = () => {
    for (const segment of engine.checkInactivity(Date.now())) {
      absorbChunk(segment);
    }
  };

  safeSend({
    type: 'CONTENT_SCRIPT_READY',
    payload: { meetCode, url: location.href, startedAt: meetingStart },
  });
  bootLogger.info('handshake sent');

  const inactivityTimer = window.setInterval(flushFinalized, 1000);

  const observer = createCaptionObserver({
    onState: (next) => {
      const previous = signal;
      signal = next;
      if ((next === 'CAPTIONS_INACTIVE' || next === 'CAPTIONS_WAITING') && previous === 'CAPTIONS_ACTIVE') {
        absorbChunk(engine.captionGone(Date.now()));
      }
      safeSend({ type: next });
    },
    onObservation: (observation) => {
      announceMeeting();
      const hadActive = engine.active !== null;
      engine.ingest(observation);
      transcriptLogger.debug(hadActive ? 'Active segment updated' : 'Active segment created', observation.speaker, observation.text);
      safeSend({ type: 'CAPTION_OBSERVATION', payload: observation });
    },
  });

  observer.start();

  window.addEventListener('pagehide', () => {
    window.clearInterval(inactivityTimer);
    absorbChunk(engine.meetingEnded(Date.now()));
    const closing = turns.finalizeOpen(Date.now());
    if (closing) emitTurn(closing);
    observer.stop();
  }, { once: true });

  chrome.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
    if (!isRuntimeMessage(raw)) return false;
    if (raw.type === 'PING_CONTENT_SCRIPT') {
      sendResponse({ type: 'PONG_CONTENT_SCRIPT', payload: { meetCode, signal } } satisfies RuntimeMessage);
      return false;
    }
    if (raw.type !== 'GET_CONTENT_STATUS') return false;
    sendResponse({ type: 'CONTENT_STATUS', payload: { signal } } satisfies RuntimeMessage);
    return false;
  });
}
