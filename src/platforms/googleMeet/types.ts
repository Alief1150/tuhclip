export interface CaptionObservation {
  speaker: string | null;
  text: string;
  observedAt: number;
  sourceId?: string;
}

export type MeetStateSignal =
  | 'MEET_DETECTED'
  | 'CAPTIONS_WAITING'
  | 'CAPTIONS_ACTIVE'
  | 'CAPTIONS_INACTIVE';
