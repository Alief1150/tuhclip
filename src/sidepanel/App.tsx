import { useCallback, useEffect, useRef, useState } from 'react';
import { toJSON } from '../export/json';
import { toMarkdown } from '../export/markdown';
import { toText } from '../export/text';
import { isRuntimeMessage, type RuntimeMessage, type SessionSignals } from '../shared/messages';
import { createLogger } from '../shared/logger';
import { createMeeting, endMeeting, listMeetings, meetingTitleFallback, type MeetingHistoryEntry, type MeetingSession } from '../storage/meetings';
import { addSegment, listSegments } from '../storage/segments';
import type { TranscriptSegment } from '../transcript/types';
import { deriveViewState, type ViewState } from './viewState';
import { createSequentialPoll } from './poll';

const logger = createLogger('ui');

const stateCopy: Record<ViewState, { eyebrow: string; title: string; body: string; hint: string }> = {
  'not-on-meet': {
    eyebrow: 'No meeting found',
    title: 'Open a Google Meet tab',
    body: 'tuhclip reads captions from the active Google Meet tab.',
    hint: 'Your transcript stays in this browser.',
  },
  'meet-detected': {
    eyebrow: 'Meet detected',
    title: 'Connecting to the meeting',
    body: 'The page connection is being prepared.',
    hint: 'This usually finishes when the Meet page is ready.',
  },
  'captions-off': {
    eyebrow: 'Waiting for captions',
    title: 'Turn on Meet captions',
    body: 'Use the captions button in Google Meet. tuhclip will listen once text appears.',
    hint: 'No microphone or audio permission is used.',
  },
  transcribing: {
    eyebrow: 'Captions active',
    title: 'Transcript in progress',
    body: 'Spoken captions appear below as they are finalized.',
    hint: 'Keep Google Meet captions turned on.',
  },
  idle: {
    eyebrow: 'Meeting idle',
    title: 'No new caption text',
    body: 'The meeting may have ended or paused. Existing transcript text is kept locally.',
    hint: 'Return to the meeting to continue.',
  },
};

async function fetchSignals(): Promise<SessionSignals> {
  const response: unknown = await chrome.runtime.sendMessage({ type: 'GET_SESSION_STATUS' } satisfies RuntimeMessage);
  if (!isRuntimeMessage(response) || response.type !== 'SESSION_STATUS') {
    throw new Error('Invalid session response');
  }
  return response.payload;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return 'ongoing';
  const minutes = Math.floor(durationMs / 60000);
  if (minutes < 1) return 'under a minute';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

export function App() {
  const [signals, setSignals] = useState<SessionSignals | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [meeting, setMeeting] = useState<MeetingSession | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeCaption, setActiveCaption] = useState<{ speaker: string; text: string } | null>(null);
  const [history, setHistory] = useState<MeetingHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [viewing, setViewing] = useState<{ meeting: MeetingSession; segments: TranscriptSegment[] } | null>(null);
  const retry = useRef<() => void>(() => undefined);
  const meetingRef = useRef<MeetingSession | null>(null);
  meetingRef.current = meeting;

  const refresh = useCallback(async () => {
    try {
      setSignals(await fetchSignals());
      setError(false);
    } catch (cause) {
      logger.error('Session status failed', cause);
      setError(true);
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await listMeetings());
      setHistoryError(false);
    } catch (cause) {
      logger.error('History load failed', cause);
      setHistoryError(true);
    }
  }, []);

  useEffect(() => {
    const poll = createSequentialPoll(refresh, 2000);
    retry.current = poll.retry;
    poll.start();
    return poll.stop;
  }, [refresh]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const onSignal = (raw: unknown) => {
      if (!isRuntimeMessage(raw)) return;
      if (raw.type === 'MEET_DETECTED' || raw.type === 'CAPTIONS_WAITING' || raw.type === 'CAPTIONS_ACTIVE' || raw.type === 'CAPTIONS_INACTIVE') {
        retry.current();
        if (raw.type === 'CAPTIONS_INACTIVE') {
          setActiveCaption(null);
          const current = meetingRef.current;
          if (current && current.endedAt === undefined) {
            const endedAt = Date.now();
            void endMeeting(current.id, endedAt).then(() => {
              setMeeting({ ...current, endedAt, durationMs: Math.max(0, endedAt - current.startedAt) });
              void refreshHistory();
            });
          }
        }
        return;
      }
      if (raw.type === 'MEETING_STARTED') {
        const title = raw.payload.title.trim() || meetingTitleFallback(raw.payload.startedAt);
        const session: MeetingSession = {
          id: raw.payload.meetingId,
          title,
          meetUrl: raw.payload.meetUrl,
          startedAt: raw.payload.startedAt,
          createdAt: Date.now(),
        };
        void createMeeting(session).then((stored) => {
          setMeeting(stored);
          setSegments([]);
          setActiveCaption(null);
          setViewing(null);
          void refreshHistory();
        }).catch((cause) => logger.error('Meeting create failed', cause));
        return;
      }
      if (raw.type === 'CAPTION_OBSERVATION') {
        setActiveCaption({
          speaker: raw.payload.speaker?.trim() ? raw.payload.speaker : 'Unknown speaker',
          text: raw.payload.text,
        });
        return;
      }
      if (raw.type === 'TRANSCRIPT_SEGMENT') {
        const segment = raw.payload;
        void addSegment(segment).then((stored) => {
          if (!stored) return;
          setActiveCaption(null);
          if (meetingRef.current?.id === segment.meetingId) {
            setSegments((previous) => [...previous, segment]);
          }
          void refreshHistory();
        }).catch((cause) => logger.error('Segment persist failed', cause));
      }
    };
    chrome.runtime.onMessage.addListener(onSignal);
    return () => chrome.runtime.onMessage.removeListener(onSignal);
  }, [refreshHistory]);

  const openHistoryEntry = useCallback(async (entry: MeetingHistoryEntry) => {
    try {
      const full = await listSegments(entry.id);
      setViewing({ meeting: entry, segments: full });
    } catch (cause) {
      logger.error('History open failed', cause);
      setHistoryError(true);
    }
  }, []);

  const exportCurrent = useCallback((format: 'txt' | 'md' | 'json') => {
    if (!meeting) return;
    const slug = meeting.id.replace(/[^a-z0-9]+/gi, '-');
    if (format === 'txt') download(`${slug}.txt`, toText(meeting, segments), 'text/plain');
    else if (format === 'md') download(`${slug}.md`, toMarkdown(meeting, segments), 'text/markdown');
    else download(`${slug}.json`, toJSON(meeting, segments), 'application/json');
  }, [meeting, segments]);

  const exportViewing = useCallback((format: 'txt' | 'md' | 'json') => {
    if (!viewing) return;
    const slug = viewing.meeting.id.replace(/[^a-z0-9]+/gi, '-');
    if (format === 'txt') download(`${slug}.txt`, toText(viewing.meeting, viewing.segments), 'text/plain');
    else if (format === 'md') download(`${slug}.md`, toMarkdown(viewing.meeting, viewing.segments), 'text/markdown');
    else download(`${slug}.json`, toJSON(viewing.meeting, viewing.segments), 'application/json');
  }, [viewing]);

  const state = signals ? deriveViewState(signals) : null;
  const copy = state ? stateCopy[state] : null;

  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          <img src="/paperclip.png" alt="" className="brand-mark" />
          <span>tuhclip</span>
        </div>
        <span className="local-note">local only</span>
      </header>

      <nav className="tabs" aria-label="tuhclip sections">
        <button type="button" className={tab === 'live' ? 'tab-active' : ''} aria-current={tab === 'live' ? 'page' : undefined} onClick={() => setTab('live')}>Live</button>
        <button type="button" className={tab === 'history' ? 'tab-active' : ''} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => { setTab('history'); void refreshHistory(); }}>History</button>
      </nav>

      {tab === 'live' ? (
        <section className="document" aria-live="polite" aria-busy={!signals && !error}>
          <div className="document-rule" />
          {error ? (
            <div className="state-content">
              <p className="eyebrow error-label">Connection error</p>
              <h1>Could not read this tab</h1>
              <p>Chrome did not return the meeting status. Check the active tab, then retry.</p>
              <button type="button" onClick={() => retry.current()}>Check active tab</button>
            </div>
          ) : !copy ? (
            <div className="state-content loading">
              <p className="eyebrow">Checking active tab</p>
              <h1>Finding your meeting</h1>
              <p>Reading the current Chrome tab.</p>
            </div>
          ) : state !== 'transcribing' && segments.length === 0 ? (
            <div className="state-content">
              <p className="eyebrow"><span className={`status-dot status-${state}`} />{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p>{copy.body}</p>
              <p className="hint">{copy.hint}</p>
              {(state === 'not-on-meet' || state === 'meet-detected') && (
                <button type="button" onClick={() => retry.current()}>Check active tab</button>
              )}
            </div>
          ) : (
            <div className="transcript">
              <p className="eyebrow"><span className={`status-dot status-${state}`} />{meeting?.title ?? copy.eyebrow}</p>
              {activeCaption && (
                <div className="segment segment-active" aria-label="Current caption">
                  <p className="segment-meta">{formatTime(Date.now())} {activeCaption.speaker}</p>
                  <p className="segment-text">{activeCaption.text}</p>
                </div>
              )}
              {segments.length === 0 && !activeCaption ? (
                <div className="state-content">
                  <h1>Listening</h1>
                  <p>Finalized captions will appear here. Keep Google Meet captions turned on.</p>
                </div>
              ) : (
                <ol className="segment-list">
                  {segments.map((segment) => (
                    <li key={segment.id} className="segment">
                      <p className="segment-meta">{formatTime(segment.startedAt)} {segment.speaker}</p>
                      <p className="segment-text">{segment.text}</p>
                    </li>
                  ))}
                </ol>
              )}
              {meeting && segments.length > 0 && (
                <div className="export-row" role="group" aria-label="Export current transcript">
                  <button type="button" onClick={() => exportCurrent('txt')}>Save TXT</button>
                  <button type="button" onClick={() => exportCurrent('md')}>Save MD</button>
                  <button type="button" onClick={() => exportCurrent('json')}>Save JSON</button>
                </div>
              )}
            </div>
          )}
        </section>
      ) : viewing ? (
        <section className="document">
          <div className="document-rule" />
          <div className="transcript">
            <p className="eyebrow">Saved transcript</p>
            <h1>{viewing.meeting.title}</h1>
            <p className="hint">{new Date(viewing.meeting.startedAt).toLocaleString()} {formatDuration(viewing.meeting.durationMs)} {viewing.segments.length} lines</p>
            {viewing.segments.length === 0 ? (
              <p>No segments were recorded for this meeting.</p>
            ) : (
              <ol className="segment-list">
                {viewing.segments.map((segment) => (
                  <li key={segment.id} className="segment">
                    <p className="segment-meta">{formatTime(segment.startedAt)} {segment.speaker}</p>
                    <p className="segment-text">{segment.text}</p>
                  </li>
                ))}
              </ol>
            )}
            <div className="export-row" role="group" aria-label="Export saved transcript">
              <button type="button" onClick={() => exportViewing('txt')}>Save TXT</button>
              <button type="button" onClick={() => exportViewing('md')}>Save MD</button>
              <button type="button" onClick={() => exportViewing('json')}>Save JSON</button>
              <button type="button" onClick={() => setViewing(null)}>Back to list</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="document" aria-live="polite">
          <div className="document-rule" />
          <div className="transcript">
            <p className="eyebrow">Meeting history</p>
            {historyError ? (
              <div className="state-content">
                <h1>History unavailable</h1>
                <p>Stored meetings could not be read. Your data stays in this browser.</p>
                <button type="button" onClick={() => void refreshHistory()}>Retry history</button>
              </div>
            ) : history.length === 0 ? (
              <div className="state-content">
                <h1>No meetings yet</h1>
                <p>Finalized transcripts appear here after your first captioned meeting.</p>
              </div>
            ) : (
              <ol className="history-list">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className="history-item" onClick={() => void openHistoryEntry(entry)}>
                      <span className="history-title">{entry.title}</span>
                      <span className="history-meta">{new Date(entry.startedAt).toLocaleString()} {formatDuration(entry.durationMs)} {entry.segmentCount} lines</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      <footer>
        <span>tuhclip</span>
        <span>Google Meet</span>
      </footer>
    </main>
  );
}
