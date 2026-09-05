import type { TranscriptSegment } from '../transcript/types';
import { storeGet, storeGetAllByIndex, storePut } from './db';

export async function addSegment(segment: TranscriptSegment): Promise<boolean> {
  const existing = await storeGet<TranscriptSegment>('segments', segment.id).catch(() => null);
  if (existing) return false;
  await storePut('segments', segment);
  return true;
}

export async function listSegments(meetingId: string): Promise<TranscriptSegment[]> {
  const segments = await storeGetAllByIndex<TranscriptSegment>('segments', 'by-meeting', meetingId).catch(
    () => [],
  );
  return segments.sort((a, b) => a.startedAt - b.startedAt || a.endedAt - b.endedAt);
}
