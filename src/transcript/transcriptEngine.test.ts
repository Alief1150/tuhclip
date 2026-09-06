import { describe, expect, it } from 'vitest';
import { TranscriptEngine } from './transcriptEngine';

const observation = (speaker: string | null, text: string, observedAt: number, sourceId?: string) => ({
  speaker,
  text,
  observedAt,
  ...(sourceId === undefined ? {} : { sourceId }),
});

describe('TranscriptEngine', () => {
  it('finalizes progressive captions as one segment', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 1000 });
    engine.ingest(observation('Alief', 'saya', 1000));
    engine.ingest(observation('Alief', 'saya ingin', 1100));
    engine.ingest(observation('Alief', 'saya ingin bertanya', 1200));
    const finalized = engine.finalizeActive(2000);
    expect(finalized).not.toBeNull();
    expect(finalized?.text).toBe('saya ingin bertanya');
    expect(engine.finalized).toHaveLength(1);
  });

  it('ignores repeated identical observer events', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 1000 });
    for (let i = 0; i < 5; i += 1) {
      engine.ingest(observation('Alief', 'Halo semuanya', 1000 + i * 100));
    }
    engine.finalizeActive(5000);
    expect(engine.finalized).toHaveLength(1);
  });

  it('finalizes previous segment on speaker change', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 1000 });
    engine.ingest(observation('Alief', 'Halo semuanya', 1000));
    engine.ingest(observation('Mahdi', 'Halo Lif', 1500));
    engine.finalizeActive(2000);
    expect(engine.finalized).toHaveLength(2);
    expect(engine.finalized[0].speaker).toBe('Alief');
    expect(engine.finalized[1].speaker).toBe('Mahdi');
  });

  it('treats whitespace-only changes as no new segment', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 1000 });
    engine.ingest(observation('Alief', 'Halo semuanya', 1000));
    engine.ingest(observation('Alief', '  Halo   semuanya  ', 1100));
    engine.finalizeActive(2000);
    expect(engine.finalized).toHaveLength(1);
  });

  it('preserves genuine repetition outside the duplicate window', () => {
    const engine = new TranscriptEngine({
      meetingId: 'm1',
      meetingStart: 0,
      duplicateWindowMs: 60_000,
    });
    engine.ingest(observation('Alief', 'Setuju', 0));
    engine.finalizeActive(1000);
    engine.ingest(observation('Alief', 'Setuju', 300_000));
    engine.finalizeActive(301_000);
    expect(engine.finalized).toHaveLength(2);
  });

  it('finalizes safely when captions toggle off and resumes after', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 1000 });
    engine.ingest(observation('Alief', 'Halo semuanya', 1000));
    engine.captionGone(1500);
    expect(engine.finalized).toHaveLength(1);
    expect(engine.active).toBeNull();
    engine.ingest(observation('Alief', 'Lanjut lagi', 5000));
    engine.finalizeActive(6000);
    expect(engine.finalized).toHaveLength(2);
  });

  it('finalizes each turn exactly once under rapid speaker switching', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    const turns: Array<[string, string]> = [
      ['Alief', 'Satu'],
      ['Mahdi', 'Dua'],
      ['Alief', 'Tiga'],
      ['Mahdi', 'Empat'],
    ];
    turns.forEach(([speaker, text], index) => {
      engine.ingest(observation(speaker, text, index * 100));
    });
    engine.finalizeActive(1000);
    expect(engine.finalized.map((segment) => segment.text)).toEqual(['Satu', 'Dua', 'Tiga', 'Empat']);
  });

  it('splits distinct same-speaker sentences into separate segments', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('Alief', 'Cuaca cerah hari ini', 0));
    engine.ingest(observation('Alief', 'Jaringan padat merayap', 500));
    engine.finalizeActive(1000);
    expect(engine.finalized).toHaveLength(2);
  });

  it('ignores empty caption text without creating segments', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('Alief', '   ', 0));
    expect(engine.active).toBeNull();
    expect(engine.finalizeActive(1000)).toBeNull();
  });

  it('finalizes the active segment when the meeting ends', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('Alief', 'Terima kasih', 0));
    const segment = engine.meetingEnded(500);
    expect(segment?.text).toBe('Terima kasih');
    expect(engine.active).toBeNull();
  });

  it('does not split turns when the speaker label casing flickers', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('You', 'halo', 0));
    engine.ingest(observation('you', 'halo bandung', 500));
    engine.ingest(observation(' YOU ', 'halo bandung sudah lama', 1000));
    engine.finalizeActive(2000);
    expect(engine.finalized).toHaveLength(1);
    expect(engine.finalized[0].text).toBe('halo bandung sudah lama');
  });

  it('reconciles overlapping re-renders instead of committing', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('Alief', 'halo bandung sudah lama', 0));
    engine.ingest(observation('Alief', 'bandung sudah lama', 500));
    engine.finalizeActive(1000);
    expect(engine.finalized).toHaveLength(1);
    expect(engine.finalized[0].text).toBe('halo bandung sudah lama');
  });

  it('inherits the active speaker when the label temporarily disappears', () => {
    const engine = new TranscriptEngine({ meetingId: 'm1', meetingStart: 0 });
    engine.ingest(observation('Alief', 'halo', 0));
    engine.ingest(observation(null, 'halo bandung', 500));
    engine.finalizeActive(1000);
    expect(engine.finalized).toHaveLength(1);
    expect(engine.finalized[0].speaker).toBe('Alief');
    expect(engine.finalized[0].text).toBe('halo bandung');
  });

  it('finalizes on inactivity timeout', () => {
    const engine = new TranscriptEngine({
      meetingId: 'm1',
      meetingStart: 0,
      inactivityTimeoutMs: 2000,
    });
    engine.ingest(observation('Alief', 'Halo', 0));
    const finalized = engine.checkInactivity(2500);
    expect(finalized).toHaveLength(1);
    expect(engine.active).toBeNull();
  });
});
