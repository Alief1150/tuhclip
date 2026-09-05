import { describe, expect, it } from 'vitest';
import { toJSON } from './json';
import { toMarkdown } from './markdown';
import { toText } from './text';
import type { MeetingSession } from '../storage/meetings';
import type { TranscriptSegment } from '../transcript/types';

const meeting: MeetingSession = {
  id: 'm1',
  title: 'Weekly Sync',
  meetUrl: 'https://meet.google.com/abc-defg-hij',
  startedAt: new Date('2026-09-04T19:30:00').getTime(),
  createdAt: new Date('2026-09-04T19:30:00').getTime(),
};

const segments: TranscriptSegment[] = [
  {
    id: 's1', meetingId: 'm1', speaker: 'Alief Athallah',
    text: 'Saya ingin bertanya mengenai jaringan.',
    startedAt: new Date('2026-09-04T19:31:21').getTime(),
    endedAt: new Date('2026-09-04T19:31:25').getTime(),
    relativeStartMs: 81_000,
  },
  {
    id: 's2', meetingId: 'm1', speaker: 'Mahdi',
    text: 'Silakan.',
    startedAt: new Date('2026-09-04T19:31:30').getTime(),
    endedAt: new Date('2026-09-04T19:31:32').getTime(),
    relativeStartMs: 90_000,
  },
];

describe('export formats', () => {
  it('renders TXT with timestamps, speakers, and text', () => {
    const output = toText(meeting, segments);
    expect(output).toContain('Weekly Sync');
    expect(output).toContain('[00:01:21] Alief Athallah');
    expect(output).toContain('Saya ingin bertanya mengenai jaringan.');
    expect(output).toContain('[00:01:30] Mahdi');
    expect(output).toContain('Silakan.');
  });

  it('renders Markdown matching the spec example shape', () => {
    const output = toMarkdown(meeting, segments);
    expect(output).toContain('# Weekly Sync');
    expect(output).toContain('## Transcript');
    expect(output).toContain('**[00:01:21] Alief Athallah**');
    expect(output).toContain('Saya ingin bertanya mengenai jaringan.');
    expect(output).toContain('**[00:01:30] Mahdi**');
    expect(output).toContain('Silakan.');
  });

  it('renders JSON preserving structured metadata and segments', () => {
    const parsed = JSON.parse(toJSON(meeting, segments)) as {
      meeting: MeetingSession;
      segments: TranscriptSegment[];
    };
    expect(parsed.meeting.id).toBe('m1');
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.segments[0].relativeStartMs).toBe(81_000);
  });

  it('handles empty transcripts without crashing', () => {
    expect(toText(meeting, [])).toContain('Weekly Sync');
    expect(toMarkdown(meeting, [])).toContain('# Weekly Sync');
    expect(JSON.parse(toJSON(meeting, [])).segments).toEqual([]);
  });
});
