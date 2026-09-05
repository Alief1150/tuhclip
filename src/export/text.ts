import type { MeetingSession } from '../storage/meetings';
import type { TranscriptSegment } from '../transcript/types';
import { formatClock, formatDate, formatRelative } from './format';

export function toText(meeting: MeetingSession, segments: TranscriptSegment[]): string {
  const lines = [
    meeting.title,
    `Date: ${formatDate(meeting.startedAt)}`,
    `Started: ${formatClock(meeting.startedAt)}`,
    '',
  ];
  if (segments.length === 0) {
    lines.push('(No transcript segments recorded.)');
    return lines.join('\n');
  }
  for (const segment of segments) {
    lines.push(`[${formatRelative(segment.relativeStartMs)}] ${segment.speaker}`);
    lines.push(segment.text);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export type { MeetingSession, TranscriptSegment };
