import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { extractMeetCode } from '../background/contentHealth';
import { createCaptionObserver } from '../platforms/googleMeet/captionObserver';
import type { MeetStateSignal } from '../platforms/googleMeet/types';
import { createLogger } from '../shared/logger';
import { TranscriptEngine } from '../transcript/transcriptEngine';

declare global {
  interface Window {
    __tuhclipContentReady?: boolean;
  }
}

if (window.__tuhclipContentReady) {
  throw new Error('[tuhclip][content] duplicate content script instance ignored');
}
window.__tuhclipContentReady = true;

const bootLogger = createLogger('content');
const logger = createLogger('caption');
const transcriptLogger = createLogger('transcript');

const meetCode = extractMeetCode(location.pathname);
bootLogger.info('initialized, meet code:', meetCode || '(none)');
let signal: MeetStateSignal = 'MEET_DETECTED';

const meetingId = `meet-${Date.now().toString(36)}`;
const meetingStart = Date.now();
const engine = new TranscriptEngine({ meetingId, meetingStart });
let meetingAnnounced = false;

const send = (message: RuntimeMessage) => {
  chrome.runtime.sendMessage(message).catch((cause) => logger.debug('Runtime message unavailable', cause));
};

send({
  type: 'CONTENT_SCRIPT_READY',
  payload: { meetCode, url: location.href, startedAt: meetingStart },
});
bootLogger.info('handshake sent');

const pageTitle = () => {
  const title = document.title.trim().replace(/\s*-\s*Google Meet\s*$/i, '').trim();
  return title && title.toLowerCase() !== 'meet' ? title : '';
};

const announceMeeting = () => {
  if (meetingAnnounced) return;
  meetingAnnounced = true;
  send({
    type: 'MEETING_STARTED',
    payload: {
      meetingId,
      title: pageTitle(),
      meetUrl: location.href,
      startedAt: meetingStart,
    },
  });
};

const flushFinalized = () => {
  for (const segment of engine.checkInactivity(Date.now())) {
    transcriptLogger.debug('Segment finalized', segment.speaker, segment.text);
    send({ type: 'TRANSCRIPT_SEGMENT', payload: segment });
  }
};

const inactivityTimer = window.setInterval(flushFinalized, 1000);

const observer = createCaptionObserver({
  onState: (next) => {
    const previous = signal;
    signal = next;
    if ((next === 'CAPTIONS_INACTIVE' || next === 'CAPTIONS_WAITING') && previous === 'CAPTIONS_ACTIVE') {
      const segment = engine.captionGone(Date.now());
      if (segment) {
        transcriptLogger.debug('Segment finalized', segment.speaker, segment.text);
        send({ type: 'TRANSCRIPT_SEGMENT', payload: segment });
      }
    }
    send({ type: next });
  },
  onObservation: (observation) => {
    announceMeeting();
    const hadActive = engine.active !== null;
    engine.ingest(observation);
    transcriptLogger.debug(hadActive ? 'Active segment updated' : 'Active segment created', observation.speaker, observation.text);
    send({ type: 'CAPTION_OBSERVATION', payload: observation });
  },
});

observer.start();

window.addEventListener('pagehide', () => {
  window.clearInterval(inactivityTimer);
  const segment = engine.meetingEnded(Date.now());
  if (segment) send({ type: 'TRANSCRIPT_SEGMENT', payload: segment });
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
