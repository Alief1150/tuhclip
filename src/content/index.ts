import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { claimContentOwnership, extractMeetCode } from '../background/contentHealth';
import { readCaptionControlState } from '../platforms/googleMeet/captionControl';
import { resolveMeetingMetadata, resolveSpeakerName } from '../platforms/googleMeet/meetingMetadata';
import { createCaptionObserver } from '../platforms/googleMeet/captionObserver';
import type { MeetStateSignal } from '../platforms/googleMeet/types';
import { CAPTION_OFF_GRACE_MS } from '../shared/constants';
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

if (!claimContentOwnership(window)) {
  bootLogger.info('duplicate content script instance ignored');
} else {
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

async function requestSession(meetCode: string): Promise<{
  meetingId: string;
  meetingStart: number;
  recentTurn: { id: string; speaker: string; text: string; endedAt: number } | null;
}> {
  const fallback = { meetingId: `meet-${Date.now().toString(36)}`, meetingStart: Date.now(), recentTurn: null };
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: 'GET_OR_RESUME_MEETING_SESSION',
      payload: { meetCode, title: pageTitle(), meetUrl: location.href, now: Date.now() },
    } satisfies RuntimeMessage);
    if (isRuntimeMessage(response) && response.type === 'MEETING_SESSION') {
      return {
        meetingId: response.payload.meetingId,
        meetingStart: response.payload.startedAt,
        recentTurn: response.payload.recentTurn,
      };
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

  const { meetingId, meetingStart, recentTurn } = await requestSession(meetCode);
  const metadata = resolveMeetingMetadata(document, meetCode);
  const localName = metadata.localName;
  if (localName) bootLogger.info('local participant name resolved');
  let sentTitleQuality = -1;
  const maybeSendMetadata = () => {
    const current = resolveMeetingMetadata(document, meetCode);
    if (current.title && current.quality > sentTitleQuality) {
      sentTitleQuality = current.quality;
      safeSend({ type: 'METADATA_UPDATE', payload: { meetingId, title: current.title, quality: current.quality } });
    }
  };
  maybeSendMetadata();
  const engine = new TranscriptEngine({ meetingId, meetingStart });
  const turns = new SpeakerTurnAggregator({ meetingId, meetingStart });
  if (recentTurn) {
    turns.seedLastFinalized(recentTurn);
    bootLogger.info('resumed with recent turn, replay will extend it');
  }
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
    maybeSendMetadata();
    for (const segment of engine.checkInactivity(Date.now())) {
      absorbChunk(segment);
    }
  };

  safeSend({
    type: 'CONTENT_SCRIPT_READY',
    payload: { meetCode, url: location.href, startedAt: meetingStart },
  });
  bootLogger.info('handshake sent');

  const sendHeartbeat = () => {
    safeSend({ type: 'MEET_HEARTBEAT', payload: { meetingId, meetCode, timestamp: Date.now() } });
  };
  sendHeartbeat();
  const heartbeatTimer = window.setInterval(sendHeartbeat, 15_000);

  let captionsOffTimer: number | undefined;
  let captionsOffSent = false;
  let lastCc: 'on' | 'off' | 'unknown' = 'unknown';

  const checkCaptionControl = () => {
    const state = readCaptionControlState(document);
    if (state === lastCc || state === 'unknown') return;
    lastCc = state;
    safeSend({ type: 'CC_STATE_CHANGED', payload: { meetingId, ccOn: state === 'on' } });
  };

  const inactivityTimer = window.setInterval(flushFinalized, 1000);
  const ccCheckTimer = window.setInterval(checkCaptionControl, 10_000);

  const observer = createCaptionObserver({
    onState: (next) => {
      const previous = signal;
      signal = next;
      if (next === 'CAPTIONS_ACTIVE') {
        if (captionsOffTimer !== undefined) {
          window.clearTimeout(captionsOffTimer);
          captionsOffTimer = undefined;
        }
        captionsOffSent = false;
      }
      if ((next === 'CAPTIONS_INACTIVE' || next === 'CAPTIONS_WAITING') && previous === 'CAPTIONS_ACTIVE') {
        absorbChunk(engine.captionGone(Date.now()));
        if (captionsOffTimer === undefined && !captionsOffSent) {
          captionsOffTimer = window.setTimeout(() => {
            captionsOffTimer = undefined;
            captionsOffSent = true;
            safeSend({ type: 'CAPTIONS_OFF', payload: { meetingId, since: Date.now() } });
          }, CAPTION_OFF_GRACE_MS);
        }
      }
      checkCaptionControl();
      safeSend({ type: next, payload: { meetingId } });
    },
    onObservation: (observation) => {
      announceMeeting();
      const resolved = resolveSpeakerName(observation.speaker, localName);
      const normalized = resolved === null ? observation : { ...observation, speaker: resolved };
      const hadActive = engine.active !== null;
      engine.ingest(normalized);
      transcriptLogger.debug(hadActive ? 'Active segment updated' : 'Active segment created', normalized.speaker, normalized.text);
      safeSend({ type: 'CAPTION_OBSERVATION', payload: { ...normalized, meetingId } });
    },
  });

  observer.start();

  window.addEventListener('pagehide', () => {
    window.clearInterval(inactivityTimer);
    window.clearInterval(heartbeatTimer);
    window.clearInterval(ccCheckTimer);
    if (captionsOffTimer !== undefined) window.clearTimeout(captionsOffTimer);
    absorbChunk(engine.meetingEnded(Date.now()));
    safeSend({ type: 'SESSION_ENDED', payload: { meetingId, endedAt: Date.now() } });
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
    checkCaptionControl();
    sendResponse({ type: 'CONTENT_STATUS', payload: { signal } } satisfies RuntimeMessage);
    return false;
  });
}
