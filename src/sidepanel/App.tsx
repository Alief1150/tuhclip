import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon } from 'lucide-react';
import { toJSON } from '../export/json';
import { toMarkdown } from '../export/markdown';
import { toText } from '../export/text';
import { isRuntimeMessage, type RuntimeMessage, type SessionSignals } from '../shared/messages';
import { createLogger } from '../shared/logger';
import { createMeeting, getMeeting, listMeetings, meetCodeFromUrl, meetingTitleFallback, type MeetingHistoryEntry, type MeetingSession } from '../storage/meetings';
import type { RuntimeSession } from '../background/sessionManager';
import { listSegments, upsertSegment } from '../storage/segments';
import type { TranscriptSegment } from '../transcript/types';
import { deriveViewState } from './viewState';
import { createSequentialPoll } from './poll';
import { FollowTracker, isNearBottom, type FollowState } from './followLatest';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty';
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '../ui/menu';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Spinner } from '../ui/spinner';
import { Tabs, TabsList, TabsPanel, TabsTab } from '../ui/tabs';
import { ToastProvider, toastManager } from '../ui/toast';

const logger = createLogger('ui');

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

function StatusBadge({ state }: { state: 'transcribing' | 'background' | 'waiting' | 'connecting' | 'reconnecting' | 'idle' }) {
  if (state === 'transcribing') {
    return (
      <Badge variant="success">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success-foreground" />
        Transcribing
      </Badge>
    );
  }
  if (state === 'background') {
    return (
      <Badge variant="success">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success-foreground" />
        Transcribing in background
      </Badge>
    );
  }
  if (state === 'waiting') {
    return (
      <Badge variant="warning">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-foreground" />
        Waiting for captions
      </Badge>
    );
  }
  if (state === 'reconnecting') {
    return (
      <Badge variant="error">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive-foreground" />
        Reconnecting
      </Badge>
    );
  }
  if (state === 'idle') {
    return <Badge variant="secondary">Idle</Badge>;
  }
  return (
    <Badge variant="secondary">
      <Spinner className="size-3" />
      Connecting
    </Badge>
  );
}

function ExportMenu({ label, onExport }: { label: string; onExport: (format: 'txt' | 'md' | 'json') => void }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="outline" size="sm" aria-label={label}>
            <DownloadIcon aria-hidden="true" />
            Export
          </Button>
        }
      />
      <MenuPopup>
        <MenuItem onClick={() => onExport('txt')}>Export TXT</MenuItem>
        <MenuItem onClick={() => onExport('md')}>Export Markdown</MenuItem>
        <MenuItem onClick={() => onExport('json')}>Export JSON</MenuItem>
      </MenuPopup>
    </Menu>
  );
}

export function App() {
  const [signals, setSignals] = useState<SessionSignals | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('live');
  const [meeting, setMeeting] = useState<MeetingSession | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeCaption, setActiveCaption] = useState<{ speaker: string; text: string } | null>(null);
  const [history, setHistory] = useState<MeetingHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [viewing, setViewing] = useState<{ meeting: MeetingSession; segments: TranscriptSegment[] } | null>(null);
  const [activeSessions, setActiveSessions] = useState<RuntimeSession[]>([]);
  const selectedByUser = useRef(false);
  const retry = useRef<() => void>(() => undefined);
  const meetingRef = useRef<MeetingSession | null>(null);
  meetingRef.current = meeting;
  const followTracker = useRef(new FollowTracker());
  const liveViewport = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState<FollowState>({ following: true, unseen: 0 });

  const scrollLiveToBottom = useCallback((smooth: boolean) => {
    const viewport = liveViewport.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const handleLiveScroll = useCallback((viewport: HTMLDivElement) => {
    const id = meetingRef.current?.id;
    if (!id) return;
    setFollow(followTracker.current.onScroll(id, isNearBottom(viewport)));
  }, []);

  const jumpToLatest = useCallback(() => {
    const id = meetingRef.current?.id;
    if (!id) return;
    scrollLiveToBottom(true);
    setFollow(followTracker.current.jumpToLatest(id));
  }, [scrollLiveToBottom]);

  const refresh = useCallback(async () => {
    try {
      setSignals(await fetchSignals());
      const sessionsResponse: unknown = await chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSIONS' } satisfies RuntimeMessage);
      if (isRuntimeMessage(sessionsResponse) && sessionsResponse.type === 'ACTIVE_SESSIONS') {
        setActiveSessions(sessionsResponse.payload.sessions);
      }
      setError(false);
    } catch (cause) {
      logger.error('Session status failed', cause);
      setError(true);
    }
  }, []);

  const selectSession = useCallback(async (meetingId: string, manual: boolean) => {
    if (manual) selectedByUser.current = true;
    try {
      const stored = await getMeeting(meetingId);
      if (!stored) return;
      const full = await listSegments(meetingId);
      setMeeting(stored);
      setSegments(full);
      setActiveCaption(null);
      setFollow(followTracker.current.jumpToLatest(meetingId));
      if (!manual) selectedByUser.current = false;
    } catch (cause) {
      logger.error('Session select failed', cause);
    }
  }, []);

  const autoSelectSession = useCallback((meetingId: string) => {
    if (selectedByUser.current || meetingRef.current?.id === meetingId) return;
    void selectSession(meetingId, false);
  }, [selectSession]);

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
    let cancelled = false;
    void listMeetings().then((meetings) => {
      if (cancelled || meetingRef.current) return;
      const live = meetings.find((entry) => entry.endedAt === undefined) ?? meetings[0];
      if (!live) return;
      void listSegments(live.id).then((stored) => {
        if (cancelled || meetingRef.current) return;
        setMeeting(live);
        setSegments(stored);
        setFollow(followTracker.current.jumpToLatest(live.id));
      }).catch((cause) => logger.error('Live transcript restore failed', cause));
    }).catch((cause) => logger.error('Live meeting restore failed', cause));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = meeting?.id;
    if (!id) return;
    if (followTracker.current.forMeeting(id).following) scrollLiveToBottom(false);
  }, [activeCaption, meeting?.id, scrollLiveToBottom]);

  useEffect(() => {
    const onSignal = (raw: unknown) => {
      if (!isRuntimeMessage(raw)) return;
      if (raw.type === 'MEET_DETECTED' || raw.type === 'CAPTIONS_WAITING' || raw.type === 'CAPTIONS_ACTIVE' || raw.type === 'CAPTIONS_INACTIVE') {
        retry.current();
        if (raw.type === 'CAPTIONS_INACTIVE') {
          setActiveCaption(null);
        }
        return;
      }
      if (raw.type === 'MEETING_STARTED') {
        const title = raw.payload.title.trim() || meetingTitleFallback(raw.payload.startedAt, meetCodeFromUrl(raw.payload.meetUrl));
        const session: MeetingSession = {
          id: raw.payload.meetingId,
          title,
          meetUrl: raw.payload.meetUrl,
          startedAt: raw.payload.startedAt,
          createdAt: Date.now(),
        };
        void createMeeting(session).then((stored) => {
          if (meetingRef.current?.id !== stored.id && selectedByUser.current) {
            void refreshHistory();
            return;
          }
          selectedByUser.current = false;
          setMeeting(stored);
          setSegments([]);
          setActiveCaption(null);
          setViewing(null);
          setFollow(followTracker.current.jumpToLatest(stored.id));
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
      if (raw.type === 'TRANSCRIPT_TURN' || raw.type === 'TRANSCRIPT_SEGMENT') {
        const segment = raw.payload;
        autoSelectSession(segment.meetingId);
        void upsertSegment(segment).then(() => {
          setActiveCaption(null);
          if (meetingRef.current?.id === segment.meetingId) {
            let isNew = false;
            setSegments((previous) => {
              const index = previous.findIndex((entry) => entry.id === segment.id);
              if (index === -1) {
                isNew = true;
                return [...previous, segment];
              }
              const next = [...previous];
              next[index] = segment;
              return next;
            });
            const { shouldScroll, state } = followTracker.current.onNewItems(segment.meetingId, isNew ? 1 : 0);
            setFollow(state);
            if (shouldScroll) scrollLiveToBottom(false);
          }
          void refreshHistory();
        }).catch((cause) => logger.error('Segment persist failed', cause));
      }
    };
    chrome.runtime.onMessage.addListener(onSignal);
    return () => chrome.runtime.onMessage.removeListener(onSignal);
  }, [refreshHistory, autoSelectSession, scrollLiveToBottom]);

  const openHistoryEntry = useCallback(async (entry: MeetingHistoryEntry) => {
    try {
      const full = await listSegments(entry.id);
      setViewing({ meeting: entry, segments: full });
    } catch (cause) {
      logger.error('History open failed', cause);
      setHistoryError(true);
    }
  }, []);

  const exportWithToast = useCallback((filename: string, render: () => string, mime: string) => {
    try {
      download(filename, render(), mime);
      toastManager.add({ title: 'Export saved', description: filename, type: 'success' });
    } catch (cause) {
      logger.error('Export failed', cause);
      toastManager.add({ title: 'Export failed', description: 'Could not write the file.', type: 'error' });
    }
  }, []);

  const exportCurrent = useCallback((format: 'txt' | 'md' | 'json') => {
    if (!meeting) return;
    const slug = meeting.id.replace(/[^a-z0-9]+/gi, '-');
    if (format === 'txt') exportWithToast(`${slug}.txt`, () => toText(meeting, segments), 'text/plain');
    else if (format === 'md') exportWithToast(`${slug}.md`, () => toMarkdown(meeting, segments), 'text/markdown');
    else exportWithToast(`${slug}.json`, () => toJSON(meeting, segments), 'application/json');
  }, [meeting, segments, exportWithToast]);

  const exportViewing = useCallback((format: 'txt' | 'md' | 'json') => {
    if (!viewing) return;
    const slug = viewing.meeting.id.replace(/[^a-z0-9]+/gi, '-');
    if (format === 'txt') exportWithToast(`${slug}.txt`, () => toText(viewing.meeting, viewing.segments), 'text/plain');
    else if (format === 'md') exportWithToast(`${slug}.md`, () => toMarkdown(viewing.meeting, viewing.segments), 'text/markdown');
    else exportWithToast(`${slug}.json`, () => toJSON(viewing.meeting, viewing.segments), 'application/json');
  }, [viewing, exportWithToast]);

  const state = signals ? deriveViewState(signals) : null;
  const hasTranscript = segments.length > 0 || activeCaption !== null;

  const backgroundActive = !signals?.onMeet && !!signals?.backgroundMeetingId;
  const displayedSession = meeting ? activeSessions.find((session) => session.meetingId === meeting.id) ?? null : null;

  const openDisplayedMeeting = useCallback(() => {
    if (!meeting) return;
    void chrome.runtime.sendMessage({ type: 'OPEN_MEETING_TAB', payload: { meetingId: meeting.id } } satisfies RuntimeMessage)
      .then((response: unknown) => {
        const opened = isRuntimeMessage(response) && response.type === 'MEETING_TAB_OPENED' && response.payload.ok;
        if (!opened) {
          toastManager.add({ title: 'Meet tab unavailable', description: 'The tab may have been closed.', type: 'warning' });
          void refresh();
        }
      })
      .catch(() => {
        toastManager.add({ title: 'Meet tab unavailable', description: 'The tab may have been closed.', type: 'warning' });
      });
  }, [meeting, refresh]);
  const statusBadge = (() => {
    if (!signals || error) {
      return backgroundActive ? <StatusBadge state="background" /> : <StatusBadge state="connecting" />;
    }
    if (signals.contentMissing) return <StatusBadge state="reconnecting" />;
    if (!signals.contentReady) {
      return backgroundActive ? <StatusBadge state="background" /> : <StatusBadge state="connecting" />;
    }
    if (state === 'transcribing' || hasTranscript) return <StatusBadge state="transcribing" />;
    if (state === 'idle') return <StatusBadge state="idle" />;
    return <StatusBadge state="waiting" />;
  })();

  return (
    <ToastProvider position="bottom-center">
      <main className="flex h-dvh flex-col gap-2 overflow-hidden bg-muted p-3">
        <header className="flex shrink-0 items-center justify-between rounded-lg border bg-background px-3 py-2 shadow-xs">
          <div className="flex items-center gap-2">
            <img src="/paperclip.png" alt="" className="size-6 object-contain" />
            <span className="font-heading text-base font-bold tracking-tight">tuhclip</span>
          </div>
          <Badge variant="outline" size="sm">local only</Badge>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-2">
          <TabsList className="w-full shrink-0">
            <TabsTab value="live" className="flex-1">Live</TabsTab>
            <TabsTab value="history" className="flex-1">History</TabsTab>
          </TabsList>

          <TabsPanel value="live" className="flex min-h-0 flex-1 flex-col">
            <section aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                {statusBadge}
                <div className="flex items-center gap-1.5">
                  {displayedSession && (
                    <Button variant="outline" size="sm" onClick={openDisplayedMeeting} aria-label={`Open ${displayedSession.title || 'meeting'} in its tab`}>
                      Open Meet ↗
                    </Button>
                  )}
                  {meeting && segments.length > 0 && (
                    <ExportMenu label="Export current transcript" onExport={exportCurrent} />
                  )}
                </div>
              </div>
              {signals?.captionsOff && (
                <div role="alert" className="rounded-md border border-warning bg-warning/10 px-2.5 py-2">
                  <p className="text-sm font-semibold text-warning-foreground">Captions are off</p>
                  <p className="text-xs text-muted-foreground">
                    Turn on Google Meet captions (CC) to continue transcription. Your stored transcript is kept.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    How to enable: in the Meet toolbar, click More options (⋮), then Turn on captions.
                  </p>
                </div>
              )}
              {activeSessions.length > 1 && (
                <Menu>
                  <MenuTrigger
                    render={
                      <Button variant="outline" size="sm" aria-label={`Select active meeting, ${activeSessions.length} meetings active`}>
                        ● {activeSessions.length} meetings active ▾
                      </Button>
                    }
                  />
                  <MenuPopup>
                    {activeSessions.map((session) => (
                      <MenuItem key={session.meetingId} onClick={() => void selectSession(session.meetingId, true)}>
                        <span className="flex flex-col">
                          <span className="font-medium">{session.title || session.meetCode || session.meetingId}</span>
                          <span className="text-xs text-muted-foreground">{session.meetCode}</span>
                        </span>
                      </MenuItem>
                    ))}
                  </MenuPopup>
                </Menu>
              )}

              {error ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>Could not read this tab</EmptyTitle>
                    <EmptyDescription>Chrome did not return the meeting status. Check the active tab, then retry.</EmptyDescription>
                  </EmptyHeader>
                  <Button size="sm" onClick={() => retry.current()}>Check active tab</Button>
                </Empty>
              ) : !signals ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <Spinner className="mb-2" />
                    <EmptyTitle>Finding your meeting</EmptyTitle>
                    <EmptyDescription>Reading the current Chrome tab.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : signals.contentMissing ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>Meet tab needs a refresh</EmptyTitle>
                    <EmptyDescription>
                      This Meet tab opened before tuhclip could attach. Automatic reconnect did not succeed, so refresh the Meet tab once and reopen this panel.
                    </EmptyDescription>
                  </EmptyHeader>
                  <Button size="sm" onClick={() => retry.current()}>Retry connection</Button>
                </Empty>
              ) : state === 'not-on-meet' && !backgroundActive ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>Open a Google Meet tab</EmptyTitle>
                    <EmptyDescription>tuhclip reads captions from the active Google Meet tab. Your transcript stays in this browser.</EmptyDescription>
                  </EmptyHeader>
                  <Button size="sm" onClick={() => retry.current()}>Check active tab</Button>
                </Empty>
              ) : state === 'meet-detected' && !backgroundActive ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <Spinner className="mb-2" />
                    <EmptyTitle>Connecting to the meeting</EmptyTitle>
                    <EmptyDescription>The page connection is being prepared. This usually finishes when the Meet page is ready.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : !hasTranscript ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>{state === 'idle' ? 'No new caption text' : 'Turn on Meet captions'}</EmptyTitle>
                    <EmptyDescription>
                      {state === 'idle'
                        ? 'The meeting may have ended or paused. Existing transcript text is kept locally.'
                        : 'Use the captions button in Google Meet. tuhclip will listen once text appears. No microphone or audio permission is used.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <ScrollArea
                    className="min-h-0 flex-1"
                    viewportRef={liveViewport}
                    onViewportScroll={handleLiveScroll}
                  >
                    <ol className="flex flex-col">
                      {segments.map((segment) => (
                        <li key={segment.id} className="border-t border-border py-2 first:border-t-0 first:pt-0">
                          <p className="text-xs font-semibold text-primary">
                            {formatTime(segment.startedAt)} {segment.speaker}
                          </p>
                          <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                        </li>
                      ))}
                      {activeCaption && (
                        <li aria-label="Current caption" className="mt-1 rounded-md border border-dashed border-primary bg-accent/60 px-2 py-2">
                          <p className="text-xs font-semibold text-primary">
                            {activeCaption.speaker} <span className="font-normal text-muted-foreground">speaking</span>
                          </p>
                          <p className="text-sm leading-relaxed text-foreground">{activeCaption.text}</p>
                        </li>
                      )}
                    </ol>
                  </ScrollArea>
                  {!follow.following && follow.unseen > 0 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                      <Button size="sm" className="pointer-events-auto shadow-lg" onClick={jumpToLatest} aria-label={`Jump to latest, ${follow.unseen} new transcript items`}>
                        ↓ {follow.unseen} new
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </TabsPanel>

          <TabsPanel value="history" className="flex min-h-0 flex-1 flex-col">
            <section aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border bg-background p-3 shadow-xs">
              {viewing ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h1 className="truncate text-sm font-bold">{viewing.meeting.title}</h1>
                      <p className="text-xs text-muted-foreground">
                        {new Date(viewing.meeting.startedAt).toLocaleString()} {formatDuration(viewing.meeting.durationMs)} {viewing.segments.length} lines
                      </p>
                    </div>
                    <ExportMenu label="Export saved transcript" onExport={exportViewing} />
                  </div>
                  <Separator />
                  {viewing.segments.length === 0 ? (
                    <Empty className="py-6">
                      <EmptyHeader>
                        <EmptyDescription>No segments were recorded for this meeting.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <ScrollArea className="min-h-0 flex-1">
                      <ol className="flex flex-col">
                        {viewing.segments.map((segment) => (
                          <li key={segment.id} className="border-t border-border py-2 first:border-t-0 first:pt-0">
                            <p className="text-xs font-semibold text-primary">
                              {formatTime(segment.startedAt)} {segment.speaker}
                            </p>
                            <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                          </li>
                        ))}
                      </ol>
                    </ScrollArea>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>Back to list</Button>
                </>
              ) : historyError ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>History unavailable</EmptyTitle>
                    <EmptyDescription>Stored meetings could not be read. Your data stays in this browser.</EmptyDescription>
                  </EmptyHeader>
                  <Button size="sm" onClick={() => void refreshHistory()}>Retry history</Button>
                </Empty>
              ) : history.length === 0 ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>No meetings yet</EmptyTitle>
                    <EmptyDescription>Finalized transcripts appear here after your first captioned meeting.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <ol className="flex flex-col gap-1.5">
                    {history.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => void openHistoryEntry(entry)}
                          className="flex w-full min-h-11 cursor-pointer flex-col gap-0.5 rounded-md border border-border bg-background px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="truncate text-sm font-semibold">{entry.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.startedAt).toLocaleString()} {formatDuration(entry.durationMs)} {entry.segmentCount} lines
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              )}
            </section>
          </TabsPanel>
        </Tabs>

        <footer className="flex shrink-0 items-center justify-between px-1 text-xs text-muted-foreground">
          <span>tuhclip</span>
          <span>Google Meet</span>
        </footer>
      </main>
    </ToastProvider>
  );
}
