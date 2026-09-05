import { isRuntimeMessage, type RuntimeMessage } from '../shared/messages';
import { createCaptionObserver } from '../platforms/googleMeet/captionObserver';
import type { MeetStateSignal } from '../platforms/googleMeet/types';
import { createLogger } from '../shared/logger';
import { TranscriptEngine } from '../transcript/transcriptEngine';

const logger = createLogger('caption');
let signal: MeetStateSignal = 'MEET_DETECTED';

const meetingId = `meet-${Date.now().toString(36)}`;
const meetingStart = Date.now();
const engine = new TranscriptEngine({ meetingId, meetingStart });
let meetingAnnounced = false;

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

const send = (message: RuntimeMessage) => {
  chrome.runtime.sendMessage(message).catch((cause) => logger.debug('Runtime message unavailable', cause));
};

const flushFinalized = () => {
  for (const segment of engine.checkInactivity(Date.now())) {
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
      if (segment) send({ type: 'TRANSCRIPT_SEGMENT', payload: segment });
    }
    send({ type: next });
  },
  onObservation: (observation) => {
    announceMeeting();
    engine.ingest(observation);
    send({ type: 'CAPTION_OBSERVATION', payload: observation });
  },
});

observer.start();

window.addEventListener('pagehide', () => {
  window.clearInterval(inactivityTimer);
  engine.meetingEnded(Date.now());
  observer.stop();
}, { once: true });

chrome.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(raw) || raw.type !== 'GET_CONTENT_STATUS') return false;
  sendResponse({ type: 'CONTENT_STATUS', payload: { signal } } satisfies RuntimeMessage);
  return false;
});
