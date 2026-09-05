import type { CaptionObservation } from '../platforms/googleMeet/types';
import { RecentDedupeCache } from './deduplication';
import { displayCleanup, normalizeForComparison } from './normalization';
import type { ActiveSegment, TranscriptSegment } from './types';

export interface TranscriptEngineOptions {
  meetingId: string;
  meetingStart: number;
  inactivityTimeoutMs?: number;
  duplicateWindowMs?: number;
  now?: () => number;
  makeId?: () => string;
}

const UNKNOWN_SPEAKER = 'Unknown speaker';

let idCounter = 0;
const defaultId = () => {
  idCounter += 1;
  return `seg-${Date.now().toString(36)}-${idCounter}`;
};

function extendsProgressively(previous: string, next: string): boolean {
  if (next.length < previous.length) return false;
  return normalizeForComparison(next).startsWith(normalizeForComparison(previous));
}

export class TranscriptEngine {
  private current: ActiveSegment | null = null;
  private segments: TranscriptSegment[] = [];
  private readonly dedupe: RecentDedupeCache;
  private readonly inactivityTimeoutMs: number;
  private readonly meetingId: string;
  private readonly meetingStart: number;
  private readonly makeId: () => string;

  constructor(options: TranscriptEngineOptions) {
    this.meetingId = options.meetingId;
    this.meetingStart = options.meetingStart;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? 2000;
    this.dedupe = new RecentDedupeCache(options.duplicateWindowMs ?? 60_000);
    this.makeId = options.makeId ?? defaultId;
  }

  get active(): ActiveSegment | null {
    return this.current;
  }

  get finalized(): TranscriptSegment[] {
    return [...this.segments];
  }

  ingest(observation: CaptionObservation): void {
    const speaker = observation.speaker?.trim() ? observation.speaker.trim() : UNKNOWN_SPEAKER;
    const text = displayCleanup(observation.text);
    if (!text) return;
    const normalized = normalizeForComparison(text);

    if (!this.current) {
      this.current = {
        id: this.makeId(),
        speaker,
        text,
        normalizedText: normalized,
        startedAt: observation.observedAt,
        updatedAt: observation.observedAt,
        ...(observation.sourceId === undefined ? {} : { sourceId: observation.sourceId }),
        finalized: false,
      };
      return;
    }

    if (this.current.speaker !== speaker) {
      this.commit(this.current, observation.observedAt);
      this.current = {
        id: this.makeId(),
        speaker,
        text,
        normalizedText: normalized,
        startedAt: observation.observedAt,
        updatedAt: observation.observedAt,
        ...(observation.sourceId === undefined ? {} : { sourceId: observation.sourceId }),
        finalized: false,
      };
      return;
    }

    if (
      observation.sourceId !== undefined
      && this.current.sourceId !== undefined
      && observation.sourceId !== this.current.sourceId
    ) {
      this.commit(this.current, observation.observedAt);
      this.current = {
        id: this.makeId(),
        speaker,
        text,
        normalizedText: normalized,
        startedAt: observation.observedAt,
        updatedAt: observation.observedAt,
        sourceId: observation.sourceId,
        finalized: false,
      };
      return;
    }

    if (normalized === this.current.normalizedText) return;

    if (extendsProgressively(this.current.text, text) || extendsProgressively(text, this.current.text)) {
      this.current.text = text.length >= this.current.text.length ? text : this.current.text;
      this.current.normalizedText = normalizeForComparison(this.current.text);
      this.current.updatedAt = observation.observedAt;
      if (observation.sourceId !== undefined) this.current.sourceId = observation.sourceId;
      return;
    }

    this.commit(this.current, observation.observedAt);
    this.current = {
      id: this.makeId(),
      speaker,
      text,
      normalizedText: normalized,
      startedAt: observation.observedAt,
      updatedAt: observation.observedAt,
      ...(observation.sourceId === undefined ? {} : { sourceId: observation.sourceId }),
      finalized: false,
    };
  }

  captionGone(at: number): TranscriptSegment | null {
    return this.finalizeActive(at);
  }

  meetingEnded(at: number): TranscriptSegment | null {
    return this.finalizeActive(at);
  }

  checkInactivity(at: number): TranscriptSegment[] {
    if (this.current && at - this.current.updatedAt >= this.inactivityTimeoutMs) {
      const segment = this.finalizeActive(at);
      return segment ? [segment] : [];
    }
    return [];
  }

  finalizeActive(at: number): TranscriptSegment | null {
    if (!this.current) return null;
    const active = this.current;
    this.current = null;
    if (this.dedupe.isDuplicate(active.speaker, active.text, at)) return null;
    this.dedupe.record(active.speaker, active.text, at);
    const segment: TranscriptSegment = {
      id: active.id,
      meetingId: this.meetingId,
      speaker: active.speaker,
      text: active.text,
      startedAt: active.startedAt,
      endedAt: at,
      relativeStartMs: Math.max(0, active.startedAt - this.meetingStart),
    };
    this.segments.push(segment);
    return segment;
  }

  private commit(active: ActiveSegment, at: number): void {
    this.current = active;
    this.finalizeActive(at);
  }
}
