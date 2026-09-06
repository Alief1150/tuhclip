import { displayCleanup, normalizeForComparison } from './normalization';
import type { TranscriptSegment } from './types';

export const SPEAKER_TURN_CONTINUATION_MS = 8000;
export const SPEAKER_TURN_EXTENSION_MS = 30_000;

export interface SpeakerTurn extends TranscriptSegment {
  finalized: boolean;
}

export interface TurnChunk {
  id: string;
  meetingId: string;
  speaker: string;
  text: string;
  startedAt: number;
  endedAt: number;
  relativeStartMs: number;
}

export interface TurnIngestResult {
  turn: SpeakerTurn;
  created: boolean;
  reopened: boolean;
}

interface TurnOptions {
  meetingId: string;
  meetingStart?: number;
  continuationMs?: number;
  extensionMs?: number;
  makeId?: () => string;
}

let turnCounter = 0;
const defaultTurnId = () => {
  turnCounter += 1;
  return `turn-${Date.now().toString(36)}-${turnCounter}`;
};

export class SpeakerTurnAggregator {
  private open: SpeakerTurn | null = null;
  private finalized: SpeakerTurn[] = [];
  private lastFinalized: SpeakerTurn | null = null;
  private readonly meetingId: string;
  private readonly meetingStart: number;
  private readonly continuationMs: number;
  private readonly extensionMs: number;
  private readonly makeId: () => string;

  constructor(options: TurnOptions) {
    this.meetingId = options.meetingId;
    this.meetingStart = options.meetingStart ?? 0;
    this.continuationMs = options.continuationMs ?? SPEAKER_TURN_CONTINUATION_MS;
    this.extensionMs = options.extensionMs ?? SPEAKER_TURN_EXTENSION_MS;
    this.makeId = options.makeId ?? defaultTurnId;
  }

  get openTurn(): SpeakerTurn | null {
    return this.open ? { ...this.open } : null;
  }

  get finalizedTurns(): SpeakerTurn[] {
    return this.finalized.map((turn) => ({ ...turn }));
  }

  seedLastFinalized(summary: { id: string; speaker: string; text: string; endedAt: number }): void {
    if (this.open || this.lastFinalized) return;
    this.lastFinalized = {
      id: summary.id,
      meetingId: this.meetingId,
      speaker: summary.speaker,
      text: summary.text,
      startedAt: summary.endedAt,
      endedAt: summary.endedAt,
      relativeStartMs: Math.max(0, summary.endedAt - this.meetingStart),
      finalized: true,
    };
  }

  ingestChunk(chunk: TurnChunk): TurnIngestResult {
    const text = displayCleanup(chunk.text);
    if (!text) {
      throw new Error('SpeakerTurnAggregator received an empty chunk');
    }
    const normalized = normalizeForComparison(text);

    if (this.open && this.open.speaker === chunk.speaker) {
      const openNormalized = normalizeForComparison(this.open.text);
      if (normalized === openNormalized) {
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        return { turn: { ...this.open }, created: false, reopened: false };
      }
      if (normalized.startsWith(openNormalized)) {
        this.open.text = text;
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        return { turn: { ...this.open }, created: false, reopened: false };
      }
      if (openNormalized.startsWith(normalized)) {
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        return { turn: { ...this.open }, created: false, reopened: false };
      }
      if (chunk.startedAt - this.open.endedAt <= this.continuationMs) {
        this.open.text = `${this.open.text} ${text}`;
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        return { turn: { ...this.open }, created: false, reopened: false };
      }
      this.commitOpen(chunk.endedAt);
    } else if (this.open) {
      this.commitOpen(chunk.endedAt);
    }

    if (!this.open && this.lastFinalized && this.lastFinalized.speaker === chunk.speaker) {
      const finalizedNormalized = normalizeForComparison(this.lastFinalized.text);
      const gap = chunk.startedAt - this.lastFinalized.endedAt;
      if (normalized === finalizedNormalized && gap <= this.extensionMs) {
        return { turn: { ...this.lastFinalized }, created: false, reopened: false };
      }
      if (normalized.startsWith(finalizedNormalized) && gap <= this.extensionMs) {
        this.open = { ...this.lastFinalized, finalized: false };
        this.open.text = text;
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        this.finalized = this.finalized.filter((turn) => turn.id !== this.open?.id);
        this.lastFinalized = null;
        return { turn: { ...this.open }, created: false, reopened: true };
      }
      if (gap <= this.continuationMs && !finalizedNormalized.startsWith(normalized)) {
        this.open = { ...this.lastFinalized, finalized: false };
        this.open.text = `${this.open.text} ${text}`;
        this.open.endedAt = Math.max(this.open.endedAt, chunk.endedAt);
        this.finalized = this.finalized.filter((turn) => turn.id !== this.open?.id);
        this.lastFinalized = null;
        return { turn: { ...this.open }, created: false, reopened: true };
      }
    }

    this.open = {
      id: this.makeId(),
      meetingId: this.meetingId,
      speaker: chunk.speaker,
      text,
      startedAt: chunk.startedAt,
      endedAt: Math.max(chunk.startedAt, chunk.endedAt),
      relativeStartMs: Math.max(0, chunk.startedAt - this.meetingStart),
      finalized: false,
    };
    return { turn: { ...this.open }, created: true, reopened: false };
  }

  finalizeOpen(at: number): SpeakerTurn | null {
    if (!this.open) return null;
    const turn: SpeakerTurn = { ...this.open, endedAt: Math.max(this.open.endedAt, at), finalized: true };
    this.open = null;
    this.finalized.push(turn);
    this.lastFinalized = turn;
    return { ...turn };
  }

  private commitOpen(at: number): void {
    this.finalizeOpen(at);
  }
}
