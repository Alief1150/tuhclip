import type { MeetingSession } from '../storage/meetings';
import type { TranscriptSegment } from '../transcript/types';

export function toJSON(meeting: MeetingSession, segments: TranscriptSegment[]): string {
  return JSON.stringify({ meeting, segments }, null, 2);
}

export type { MeetingSession, TranscriptSegment };
