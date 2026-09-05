export interface ActiveSegment {
  id: string;
  speaker: string;
  text: string;
  normalizedText: string;
  startedAt: number;
  updatedAt: number;
  sourceId?: string;
  finalized: false;
}

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speaker: string;
  text: string;
  startedAt: number;
  endedAt: number;
  relativeStartMs: number;
}
