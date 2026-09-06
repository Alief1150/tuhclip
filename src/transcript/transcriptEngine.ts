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

export function normalizeSpeakerName(speaker: string): string {
  return speaker.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function startActive(
  makeId: () => string,
  speaker: string,
  text: string,
  normalized: string,
  observedAt: number,
  sourceId?: string,
): ActiveSegment {
  return {
    id: makeId(),
    speaker,
    text,
    normalizedText: normalized,
    startedAt: observedAt,
    updatedAt: observedAt,
    ...(sourceId === undefined ? {} : { sourceId }),
    finalized: false,
  };
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
    const observedLabel = observation.speaker?.trim() ? observation.speaker.trim() : null;
    const text = displayCleanup(observation.text);
    if (!text) return;
    const normalized = normalizeForComparison(text);

    if (!this.current) {
      const speaker = observedLabel ?? UNKNOWN_SPEAKER;
      this.current = startActive(this.makeId, speaker, text, normalized, observation.observedAt, observation.sourceId);
      return;
    }

    const speaker = observedLabel ?? this.resolveInheritedSpeaker(normalized);
    if (normalizeSpeakerName(this.current.speaker) !== normalizeSpeakerName(speaker)) {
      this.commit(this.current, observation.observedAt);
      this.current = startActive(this.makeId, speaker, text, normalized, observation.observedAt, observation.sourceId);
      return;
    }

    if (observedLabel) this.current.speaker = observedLabel;
    if (normalized === this.current.normalizedText) {
      this.current.updatedAt = observation.observedAt;
      if (observation.sourceId !== undefined) this.current.sourceId = observation.sourceId;
      return;
    }

    if (normalized.includes(this.current.normalizedText) || this.current.normalizedText.includes(normalized)) {
      if (normalized.length >= this.current.normalizedText.length) {
        this.current.text = text;
        this.current.normalizedText = normalized;
      }
      this.current.updatedAt = observation.observedAt;
      if (observation.sourceId !== undefined) this.current.sourceId = observation.sourceId;
      return;
    }

    this.commit(this.current, observation.observedAt);
    this.current = startActive(this.makeId, speaker, text, normalized, observation.observedAt, observation.sourceId);
  }

  private resolveInheritedSpeaker(normalized: string): string {
    if (!this.current) return UNKNOWN_SPEAKER;
    if (normalized.includes(this.current.normalizedText) || this.current.normalizedText.includes(normalized)) {
      return this.current.speaker;
    }
    return UNKNOWN_SPEAKER;
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
